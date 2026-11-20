// Dates are stored as local wall-clock strings: 'YYYY-MM-DD' and 'HH:MM'.
export const pad = (n) => String(n).padStart(2, '0');
export const todayStr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const nowHM = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return todayStr(d); };
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
export function dateRange(start, end) {
  const out = [];
  if (!start || !end) return out;
  for (let s = start; s <= end && out.length < 120; s = addDays(s, 1)) out.push(s);
  return out;
}
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dow = (s) => DOW[parseDate(s).getDay()];
export const dowLong = (s) => DOW_LONG[parseDate(s).getDay()];
export const dayNum = (s) => parseDate(s).getDate();
export const fmtDate = (s) => { const d = parseDate(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };
export const fmtDateLong = (s) => `${dowLong(s)}, ${fmtDate(s)}`;
export const minutes = (hm) => { if (!hm) return null; const [h, m] = hm.split(':').map(Number); return h * 60 + (m || 0); };
export function fmtDuration(mins) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h >= 48) return `${Math.round(h / 24)} days`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
// Hotels go at the end of the day (you check in after the day's travel); untimed items before them.
const untimedWeight = (x) => (x.kind === 'hotel' ? 2 : x.time ? 0 : 1);
export const byTime = (a, b) => (untimedWeight(a) - untimedWeight(b)) || (a.time || '99:99').localeCompare(b.time || '99:99') || (a.order ?? 0) - (b.order ?? 0);

// Distance in km between two points.
export function distanceKm(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
export function fmtDistance(km) {
  if (km == null) return '';
  if (km < 1) return `${Math.round(km * 1000 / 10) * 10} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}
// Rough travel estimate: walking under 2 km, otherwise by car/transit.
export function travelHint(km) {
  if (km == null) return '';
  const walk = Math.round((km * 1.3) / 4.8 * 60);
  if (km < 2) return `${Math.max(1, walk)} min walk`;
  return `${fmtDistance(km)} · ~${Math.max(5, Math.round(km * 1.3 / 30 * 60))} min by car / transit`;
}

export function mapsLink(p) {
  if (p?.lat != null && p?.lon != null) return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
  const q = [p?.name, p?.address, p?.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}
export function wazeLink(p) {
  if (p?.lat != null) return `https://waze.com/ul?ll=${p.lat},${p.lon}&navigate=yes`;
  return `https://waze.com/ul?q=${encodeURIComponent([p?.name, p?.city].filter(Boolean).join(' '))}&navigate=yes`;
}

// Currency of each country we might visit (local currency is the default).
const CURRENCY = { CH: 'CHF', LI: 'CHF', GB: 'GBP', US: 'USD', CZ: 'CZK', HU: 'HUF', PL: 'PLN', DK: 'DKK', SE: 'SEK', NO: 'NOK', IL: 'ILS' };
export const localCurrency = (country) => CURRENCY[(country || '').toUpperCase()] || 'EUR';
const SYMBOL = { EUR: '€', USD: '$', CHF: 'CHF ', GBP: '£', ILS: '₪' };
export const sym = (c) => SYMBOL[c] || c + ' ';
export function money(amount, cur = 'EUR', digits) {
  const n = Number(amount || 0);
  const d = digits ?? (Math.abs(n) >= 1000 || Number.isInteger(n) ? 0 : 2);
  return sym(cur) + n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export const KINDS = {
  food: 'Food & drink', market: 'Christmas market', visit: 'Sight', train: 'Train', flight: 'Flight',
  hotel: 'Hotel', car: 'Car', event: 'Event / tickets', transport: 'Local transport', gift: 'Shopping & gifts', other: 'Other'
};
export const EXPENSE_CATS = ['food', 'gift', 'transport', 'visit', 'other'];
export const EXPENSE_LABEL = { food: 'Food & drink', gift: 'Markets & gifts', transport: 'Transport', visit: 'Sights', other: 'Other' };
export const BOOKING_KINDS = ['train', 'hotel', 'car', 'flight', 'event'];
export const isBooking = (k) => BOOKING_KINDS.includes(k);

export function clsx(...a) { return a.filter(Boolean).join(' '); }
