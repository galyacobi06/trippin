import { useEffect, useState } from 'preact/hooks';
import { useApp, go } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { Header } from '../components/bits.jsx';
import { useSyncState, syncLabel } from './Trip.jsx';
import { getConfig, saveConfig, signIn, signOut, syncNow } from '../lib/sync.js';
import { put, patch, getKV, setKV, useLive, db, remove } from '../lib/db.js';
import { setCurrentTrip, createTrip } from '../lib/trip.js';
import { parseTakeoutCSV } from '../lib/services.js';
import { downloadICS } from '../lib/ics.js';
import { fmtDate } from '../lib/util.js';

export function Settings() {
  const { data, trips, tripId, toast } = useApp();
  const sync = useSyncState();
  const [cfg, setCfg] = useState({ url: '', key: '' });
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const usd = useLive(() => getKV('showUSD', true), [], true);
  useEffect(() => { getConfig().then(setCfg); }, []);

  const importCSV = async (e) => {
    const f = e.currentTarget.files?.[0];
    if (!f) return;
    const rows = parseTakeoutCSV(await f.text());
    const listName = f.name.replace(/\.csv$/i, '');
    const known = new Set(data.places.map((p) => p.name.toLowerCase()));
    let n = 0;
    for (const r of rows) {
      if (known.has(r.name.toLowerCase())) continue;
      const city = data.days.find((d) => d.city && listName.toLowerCase().includes(d.city.toLowerCase()))?.city || '';
      await put('places', { tripId, name: r.name, kind: 'visit', city, lat: r.lat, lon: r.lon, url: r.url, note: r.note, status: 'want', hours: '', parking: '', address: '', list: listName });
      n++;
    }
    e.currentTarget.value = '';
    toast(`Imported ${n} places from "${listName}"`);
  };

  return (
    <div class="screen">
      <Header title="Settings" />

      <div class="eyebrow" style={{ margin: '20px 4px 8px' }}>Sync with Mom</div>
      <div class="card pad">
        <div class="row small" style={{ gap: '8px' }}><Icon name="sync" size={16} />{syncLabel(sync)}{sync.email ? ' · ' + sync.email : ''}</div>
        {sync.error && <div class="small" style={{ color: 'var(--accent-text)', marginTop: '6px' }}>{sync.error}</div>}
        {sync.status === 'ok' || sync.status === 'syncing' || (sync.email && sync.status !== 'signed-out') ? (
          <div class="row" style={{ marginTop: '12px' }}>
            <button class="btn btn-sm" onClick={() => syncNow()}>Sync now</button>
            <button class="btn btn-sm btn-ghost" onClick={() => signOut()}>Sign out</button>
          </div>
        ) : (
          <>
            {(!cfg.url || !cfg.key) && (
              <>
                <div class="field"><label for="surl">Sync server address (from the setup guide)</label><input id="surl" class="input" placeholder="https://xxxx.supabase.co" value={cfg.url} onInput={(e) => setCfg({ ...cfg, url: e.currentTarget.value })} /></div>
                <div class="field"><label for="skey">Public key</label><input id="skey" class="input" value={cfg.key} onInput={(e) => setCfg({ ...cfg, key: e.currentTarget.value })} /></div>
                <button class="btn btn-sm" style={{ marginTop: '10px' }} onClick={async () => { await saveConfig(cfg.url, cfg.key); toast('Saved'); }}>Save server</button>
              </>
            )}
            <div class="field"><label for="em">Email</label><input id="em" class="input" type="email" autocomplete="username" value={email} onInput={(e) => setEmail(e.currentTarget.value)} /></div>
            <div class="field"><label for="pw">Password</label><input id="pw" class="input" type="password" autocomplete="current-password" value={pw} onInput={(e) => setPw(e.currentTarget.value)} /></div>
            <button class="btn btn-primary btn-block" style={{ marginTop: '12px' }} disabled={busy || !email || !pw} onClick={async () => {
              setBusy(true);
              try { if (cfg.url && cfg.key) await saveConfig(cfg.url, cfg.key); await signIn(email, pw); toast('Signed in, syncing'); } catch (e) { alert(e.message || 'Sign-in failed'); }
              setBusy(false);
            }}>Sign in</button>
          </>
        )}
      </div>

      <div class="eyebrow" style={{ margin: '20px 4px 8px' }}>Money</div>
      <div class="card pad">
        <label class="between" style={{ minHeight: '44px' }}>
          <span>Also show amounts in US dollars</span>
          <input type="checkbox" class="check" checked={usd} onChange={(e) => setKV('showUSD', e.currentTarget.checked)} />
        </label>
        <div class="muted small">New expenses start in the local currency (€ in Austria and France, CHF in Switzerland). You can switch any expense to $.</div>
      </div>

      <div class="eyebrow" style={{ margin: '20px 4px 8px' }}>Bring things in & out</div>
      <div class="stack">
        <label class="list-item" style={{ cursor: 'pointer' }}>
          <span class="ic"><Icon name="pin" size={18} /></span>
          <span class="grow"><span class="title" style={{ display: 'block' }}>Import a Google Maps list</span><span class="muted small">The .csv file from Google Takeout → Saved</span></span>
          <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={importCSV} />
        </label>
        <button class="list-item" onClick={() => downloadICS(data.trip, data.items, data.tickets)}>
          <span class="ic"><Icon name="calendar" size={18} /></span>
          <span class="grow"><span class="title" style={{ display: 'block' }}>Add plan to Calendar</span><span class="muted small">Gives you reminders before trains, flights and plans</span></span>
        </button>
      </div>

      <div class="eyebrow" style={{ margin: '20px 4px 8px' }}>Trips</div>
      <div class="stack">
        {trips.map((t) => (
          <button class="list-item" onClick={() => { setCurrentTrip(t.id); go('today'); }}>
            <span class="ic"><Icon name="bag" size={18} /></span>
            <span class="grow"><span class="title" style={{ display: 'block' }}>{t.name}</span><span class="muted small">{fmtDate(t.start)} – {fmtDate(t.end)}</span></span>
            {t.id === tripId && <span class="small" style={{ color: 'var(--open)', fontWeight: 600 }}>Open</span>}
          </button>
        ))}
        <NewTrip />
      </div>
      <TripEdit />
      <div class="muted small" style={{ textAlign: 'center', marginTop: '24px' }}>TRIPPIN version {__BUILD__} · works offline · weather Open-Meteo · places OpenStreetMap · photos Wikimedia</div>
    </div>
  );
}

function NewTrip() {
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ name: '', start: '', end: '' });
  if (!show) return <button class="btn btn-block" onClick={() => setShow(true)}><Icon name="plus" size={16} />New trip</button>;
  return (
    <div class="card pad">
      <div class="field"><label for="tn">Trip name</label><input id="tn" class="input" value={f.name} onInput={(e) => setF({ ...f, name: e.currentTarget.value })} /></div>
      <div class="two">
        <div class="field"><label for="ts">First day</label><input id="ts" class="input" type="date" value={f.start} onInput={(e) => setF({ ...f, start: e.currentTarget.value })} /></div>
        <div class="field"><label for="te">Last day</label><input id="te" class="input" type="date" value={f.end} onInput={(e) => setF({ ...f, end: e.currentTarget.value })} /></div>
      </div>
      <button class="btn btn-primary btn-block" style={{ marginTop: '12px' }} disabled={!f.name || !f.start || !f.end || f.end < f.start} onClick={async () => { await createTrip(f); go('today'); }}>Create trip</button>
    </div>
  );
}

function TripEdit() {
  const { data, toast } = useApp();
  const [f, setF] = useState({ name: data.trip.name, start: data.trip.start, end: data.trip.end });
  return (
    <>
      <div class="eyebrow" style={{ margin: '20px 4px 8px' }}>This trip</div>
      <div class="card pad">
        <div class="field" style={{ marginTop: 0 }}><label for="en">Name</label><input id="en" class="input" value={f.name} onInput={(e) => setF({ ...f, name: e.currentTarget.value })} /></div>
        <div class="two">
          <div class="field"><label for="es">First day</label><input id="es" class="input" type="date" value={f.start} onInput={(e) => setF({ ...f, start: e.currentTarget.value })} /></div>
          <div class="field"><label for="ee">Last day</label><input id="ee" class="input" type="date" value={f.end} onInput={(e) => setF({ ...f, end: e.currentTarget.value })} /></div>
        </div>
        <button class="btn btn-block" style={{ marginTop: '12px' }} disabled={!f.name || f.end < f.start} onClick={async () => { await patch('trips', data.trip.id, f); toast('Saved'); }}>Save trip</button>
      </div>
      <button class="btn btn-ghost btn-block" style={{ marginTop: '10px', color: 'var(--accent-text)' }} onClick={async () => {
        if (!confirm(`Delete "${data.trip.name}" (${data.trip.start} – ${data.trip.end}) with all its plans, tickets and expenses, on all devices?`)) return;
        for (const tbl of ['days', 'items', 'places', 'tickets', 'expenses', 'packing']) {
          for (const r of await db[tbl].where('tripId').equals(data.trip.id).toArray()) if (!r.deleted) await remove(tbl, r.id);
        }
        await remove('trips', data.trip.id);
        toast('Trip deleted');
        go('today');
      }}>Delete this trip</button>
    </>
  );
}
