import Dexie, { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';

// Everything lives on the device first (works offline), then syncs.
// Synced tables share: id, tripId, updatedAt, deleted (0/1), dirty (0/1).
export const db = new Dexie('trippin');
db.version(1).stores({
  trips: 'id, updatedAt, dirty',
  days: 'id, tripId, date, dirty',
  items: 'id, tripId, date, dirty',
  places: 'id, tripId, status, dirty',
  tickets: 'id, tripId, date, dirty',
  expenses: 'id, tripId, date, dirty',
  docs: 'id, tripId, dirty',
  packing: 'id, tripId, dirty',
  files: 'id, dirty',          // file metadata (synced)
  blobs: 'id',                 // the actual file bytes (local cache)
  kv: 'key'                    // local settings and caches (not synced)
});

export const SYNCED = ['trips', 'days', 'items', 'places', 'tickets', 'expenses', 'docs', 'packing', 'files'];

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));

export async function put(table, obj) {
  const row = { deleted: 0, ...obj, id: obj.id || uid(), updatedAt: Date.now(), dirty: 1 };
  await db[table].put(row);
  return row;
}

export async function patch(table, id, changes) {
  const cur = await db[table].get(id);
  if (!cur) return null;
  return put(table, { ...cur, ...changes });
}

export async function remove(table, id) {
  return patch(table, id, { deleted: 1 });
}

export async function getKV(key, fallback = null) {
  const r = await db.kv.get(key);
  return r ? r.value : fallback;
}
export async function setKV(key, value) {
  await db.kv.put({ key, value });
}

// Live query hook: re-renders whenever the data changes (locally or from sync).
export function useLive(fn, deps = [], initial = undefined) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const sub = liveQuery(fn).subscribe({ next: setValue, error: (e) => console.error(e) });
    return () => sub.unsubscribe();
  }, deps);
  return value;
}

export const alive = (rows) => (rows || []).filter((r) => !r.deleted);

// Files: store bytes locally, metadata syncs; other devices download on demand.
// File bytes are kept as plain data (more reliable on iPhone than storing the file object itself).
export async function storeBytes(id, blob, type) {
  const buf = await blob.arrayBuffer();
  await db.blobs.put({ id, buf, type: type || blob.type || 'application/octet-stream', size: buf.byteLength });
}
export async function getBlob(id) {
  const r = await db.blobs.get(id);
  if (!r) return null;
  if (r.buf) return new Blob([r.buf], { type: r.type });
  if (r.blob) { try { const buf = await r.blob.arrayBuffer(); if (buf.byteLength) return new Blob([buf], { type: r.blob.type }); } catch (e) { /* unreadable */ } }
  return null;
}

export async function saveFile(file, extra = {}) {
  const id = uid();
  await storeBytes(id, file, file.type);
  await put('files', { id, name: file.name || 'file', type: file.type || 'application/octet-stream', size: file.size || 0, uploaded: 0, ...extra });
  return id;
}

export async function fileURL(id) {
  if (!id) return null;
  const b = await getBlob(id);
  if (b && b.size) return URL.createObjectURL(b);
  const { downloadFile } = await import('./sync.js');
  const blob = await downloadFile(id);
  return blob ? URL.createObjectURL(blob) : null;
}
