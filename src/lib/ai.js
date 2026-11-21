// Smart reading: sends the booking screenshots (or PDF text) to our Supabase helper, which asks Google Gemini.
// Returns null when it's off, offline, not set up, or fails, and the app then reads on the device.
import { getKV } from './db.js';

async function shrink(blob) {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const out = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  const buf = new Uint8Array(await out.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { mime: 'image/jpeg', data: btoa(s) };
}

export async function aiEnabled() { return (await getKV('aiReading', true)) !== false; }

export async function aiRead({ images = [], text = '', trip }) {
  if (!navigator.onLine || !(await aiEnabled())) return null;
  const { getClient } = await import('./sync.js');
  const c = await getClient();
  if (!c) return null;
  const { data: sess } = await c.auth.getSession();
  if (!sess?.session) return null;
  try {
    const payload = { images: [], text, tripStart: trip?.start || '', tripEnd: trip?.end || '' };
    for (const im of images.slice(0, 8)) payload.images.push(await shrink(im));
    const { data, error } = await c.functions.invoke('read-booking', { body: payload });
    if (error || !data?.booking) { console.warn('read-booking', error || data); return null; }
    const b = data.booking;
    const kinds = ['flight', 'train', 'hotel', 'car', 'event'];
    return {
      kind: kinds.includes(b.kind) ? b.kind : '', title: b.title || '', date: /^\d{4}-\d{2}-\d{2}$/.test(b.date || '') ? b.date : '',
      time: /^\d{1,2}:\d{2}$/.test(b.time || '') ? b.time.padStart(5, '0') : '', endDate: /^\d{4}-\d{2}-\d{2}$/.test(b.endDate || '') ? b.endDate : '',
      from: b.from || '', to: b.to || '', car: b.flightOrCoach || '', seat: b.seat || '', confirmation: b.confirmation || '',
      address: b.address || '', price: b.price ? String(b.price) : '', currency: (b.currency || '').toUpperCase().slice(0, 3),
      note: [b.note, b.endTime && (b.kind === 'flight' ? 'arrives ' : 'until ') + b.endTime, b.travellers && 'for ' + b.travellers].filter(Boolean).join(' · ')
    };
  } catch (e) { console.warn('aiRead', e); return null; }
}
