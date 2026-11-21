import { createClient } from '@supabase/supabase-js';
import { db, SYNCED, getKV, setKV } from './db.js';

// Sync between the 3 devices through a private Supabase project.
// The app works fully without it (local only) until the account is connected.

let client = null;
let clientKey = '';
const listeners = new Set();
export const syncState = { status: 'off', last: null, error: null, email: null };
const emit = () => listeners.forEach((fn) => fn({ ...syncState }));
export const onSync = (fn) => { listeners.add(fn); fn({ ...syncState }); return () => listeners.delete(fn); };

export async function getConfig() {
  const saved = await getKV('supabase', null);
  const url = saved?.url || import.meta.env.VITE_SUPABASE_URL || '';
  const key = saved?.key || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return { url, key };
}

export async function saveConfig(url, key) {
  await setKV('supabase', { url: url.trim(), key: key.trim() });
  client = null;
}

export async function getClient() {
  const { url, key } = await getConfig();
  if (!url || !key) return null;
  if (!client || clientKey !== url + key) {
    client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'trippin-auth' } });
    clientKey = url + key;
  }
  return client;
}

// Plain-language explanations for the errors people actually hit.
export function explain(e) {
  const m = (e?.message || String(e || '')).toLowerCase();
  if (/invalid login credentials/.test(m)) return 'Email or password is wrong. Check for a space at the end of the email, or set a new password in Supabase → Authentication → Users.';
  if (/email not confirmed/.test(m)) return 'This account isn’t confirmed yet. In Supabase → Authentication → Users, open the user and confirm them (or recreate with “Auto Confirm User”).';
  if (/row-level security|violates row|permission denied|42501/.test(m)) return 'Signed in, but this email isn’t on the allowed list. Add it in Supabase (allowed_users table) exactly as typed here.';
  if (/could not find the table|relation .* does not exist|schema cache|42p01|pgrst205/.test(m)) return 'The database setup script hasn’t been run yet in Supabase (SQL Editor).';
  if (/bucket not found/.test(m)) return 'The file storage isn’t set up: run the setup script in Supabase again.';
  if (/failed to fetch|network|load failed/.test(m)) return 'Couldn’t reach the sync server. Check the internet connection and try again.';
  if (/invalid api key|no api key|jwt/.test(m)) return 'The app’s sync key isn’t accepted. Tell Claude: “invalid API key”.';
  return e?.message || String(e);
}

export async function signIn(email, password) {
  const c = await getClient();
  if (!c) throw new Error('Connect the sync account first.');
  const { error } = await c.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(explain(error));
  await syncNow();
  if (syncState.status === 'error') throw new Error(syncState.error);
}

export async function signOut() {
  const c = await getClient();
  if (c) await c.auth.signOut();
  syncState.status = 'signed-out'; syncState.email = null; emit();
}

async function session() {
  const c = await getClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session ? { c, user: data.session.user } : null;
}

let running = false;
export async function syncNow() {
  if (running) return;
  if (!navigator.onLine) { syncState.status = 'offline'; emit(); return; }
  const s = await session();
  if (!s) { syncState.status = (await getClient()) ? 'signed-out' : 'off'; emit(); return; }
  running = true;
  syncState.status = 'syncing'; syncState.email = s.user.email; syncState.error = null; emit();
  try {
    await uploadFiles(s.c);
    await push(s.c);
    await pull(s.c);
    syncState.status = 'ok'; syncState.last = Date.now();
    prefetchFiles(s.c);
  } catch (e) {
    console.error(e);
    syncState.status = 'error'; syncState.error = explain(e);
  } finally {
    running = false; emit();
  }
}

async function push(c) {
  for (const tbl of SYNCED) {
    const rows = await db[tbl].where('dirty').equals(1).toArray();
    if (!rows.length) continue;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const payload = chunk.map((r) => {
        const { dirty, ...data } = r;
        return { id: r.id, tbl, trip_id: r.tripId || null, data, updated_at: r.updatedAt, deleted: !!r.deleted };
      });
      const { error } = await c.from('records').upsert(payload);
      if (error) throw error;
      await db.transaction('rw', db[tbl], async () => {
        for (const r of chunk) {
          const cur = await db[tbl].get(r.id);
          if (cur && cur.updatedAt === r.updatedAt) await db[tbl].update(r.id, { dirty: 0 });
        }
      });
    }
  }
}

async function pull(c) {
  let cursor = await getKV('syncCursor', '1970-01-01T00:00:00Z');
  for (let guard = 0; guard < 50; guard++) {
    const since = new Date(new Date(cursor).getTime() - 5000).toISOString();
    const { data, error } = await c.from('records').select('*').gt('server_ts', since).order('server_ts').limit(1000);
    if (error) throw error;
    if (!data.length) break;
    for (const rec of data) {
      if (!SYNCED.includes(rec.tbl)) continue;
      const cur = await db[rec.tbl].get(rec.id);
      if (!cur || (cur.updatedAt || 0) < rec.updated_at || (!cur.dirty && cur.updatedAt !== rec.updated_at)) {
        if (cur && cur.dirty && cur.updatedAt > rec.updated_at) continue;
        await db[rec.tbl].put({ ...rec.data, deleted: rec.deleted ? 1 : 0, updatedAt: rec.updated_at, dirty: 0 });
      }
    }
    const newest = data[data.length - 1].server_ts;
    if (newest === cursor) break;
    cursor = newest;
    await setKV('syncCursor', cursor);
    if (data.length < 1000) break;
  }
}

async function uploadFiles(c) {
  const pending = (await db.files.toArray()).filter((f) => !f.uploaded && !f.deleted);
  for (const f of pending) {
    const b = await db.blobs.get(f.id);
    if (!b) continue;
    const { error } = await c.storage.from('trippin').upload(f.id, b.blob, { upsert: true, contentType: f.type });
    if (error) throw error;
    await db.files.put({ ...f, uploaded: 1, updatedAt: Date.now(), dirty: 1 });
  }
}

export async function downloadFile(id) {
  const s = await session();
  if (!s || !navigator.onLine) return null;
  const { data, error } = await s.c.storage.from('trippin').download(id);
  if (error || !data) return null;
  await db.blobs.put({ id, blob: data });
  return data;
}

// Keep every ticket and document on each device so they open with no signal.
async function prefetchFiles(c) {
  const files = (await db.files.toArray()).filter((f) => f.uploaded && !f.deleted);
  for (const f of files) {
    if (await db.blobs.get(f.id)) continue;
    try { await downloadFile(f.id); } catch (e) { /* try again next sync */ }
  }
}

export function startAutoSync() {
  syncNow();
  window.addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  setInterval(() => syncNow(), 60000);
  // Push local changes shortly after they happen.
  let t = null;
  for (const tbl of SYNCED) {
    db[tbl].hook('creating', () => { clearTimeout(t); t = setTimeout(syncNow, 1500); });
    db[tbl].hook('updating', () => { clearTimeout(t); t = setTimeout(syncNow, 1500); });
  }
}
