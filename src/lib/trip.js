import { db, put, getKV, setKV, useLive, alive, uid } from './db.js';
import { dateRange, todayStr, byTime, fmtDateLong } from './util.js';

export function useTrips() {
  return alive(useLive(() => db.trips.toArray(), [], []));
}

export function useCurrentTripId() {
  return useLive(() => getKV('currentTrip'), [], undefined);
}

export async function setCurrentTrip(id) { await setKV('currentTrip', id); }

export function useTripData(tripId) {
  const q = (tbl) => () => (tripId ? db[tbl].where('tripId').equals(tripId).toArray() : []);
  const trip = useLive(() => (tripId ? db.trips.get(tripId) : null), [tripId], null);
  const days = alive(useLive(q('days'), [tripId], []));
  const items = alive(useLive(q('items'), [tripId], []));
  const places = alive(useLive(q('places'), [tripId], []));
  const tickets = alive(useLive(q('tickets'), [tripId], []));
  const expenses = alive(useLive(q('expenses'), [tripId], []));
  return { trip, days, items, places, tickets, expenses };
}

export function dayInfo(days, date) {
  return days.find((d) => d.date === date) || { date, city: '', lat: null, lon: null, country: '' };
}

export function itemsOn(items, date) {
  return items.filter((i) => i.date === date).sort(byTime);
}

export function pickDefaultDate(trip) {
  const t = todayStr();
  if (!trip) return t;
  if (t >= trip.start && t <= trip.end) return t;
  return trip.start;
}

export async function createTrip({ name, start, end }) {
  const trip = await put('trips', { name, start, end, travellers: ['Gal', 'Mom'] });
  await put('trips', { ...trip, tripId: trip.id });
  for (const date of dateRange(start, end)) await put('days', { tripId: trip.id, date, city: '', lat: null, lon: null, country: '' });
  await setCurrentTrip(trip.id);
  return trip;
}

// The real Christmas 2026 trip (from Gal). Bookings get attached as they're uploaded.
const C = {
  vienna: { city: 'Vienna', lat: 48.2082, lon: 16.3738, country: 'AT' },
  salzburg: { city: 'Salzburg', lat: 47.8095, lon: 13.055, country: 'AT' },
  zurich: { city: 'Zurich', lat: 47.3769, lon: 8.5417, country: 'CH' },
  montreux: { city: 'Montreux', lat: 46.4312, lon: 6.9107, country: 'CH' },
  colmar: { city: 'Colmar', lat: 48.0794, lon: 7.3585, country: 'FR' },
  strasbourg: { city: 'Strasbourg', lat: 48.5734, lon: 7.7521, country: 'FR' },
  paris: { city: 'Paris', lat: 48.8566, lon: 2.3522, country: 'FR' }
};

export async function seedChristmasTrip() {
  const id = uid();
  await put('trips', { id, tripId: id, name: 'Christmas 2026', start: '2026-12-06', end: '2026-12-15', travellers: ['Gal', 'Mom'] });
  const plan = [
    ['2026-12-06', C.vienna, [['flight', 'Flight Tel Aviv → Vienna', 'Add the flight ticket'], ['hotel', 'Sleep in Vienna', 'Add the hotel booking']]],
    ['2026-12-07', C.salzburg, [['train', 'Train Vienna → Salzburg', 'Add the train ticket'], ['hotel', 'Sleep in Salzburg', 'Add the hotel booking']]],
    ['2026-12-08', C.zurich, [['train', 'Train Salzburg → Zurich', 'Add the train ticket'], ['hotel', 'Sleep in Zurich', 'Add the hotel booking']]],
    ['2026-12-09', C.zurich, [['car', 'Pick up rental car', 'Until 13 Dec · add the rental booking'], ['hotel', 'Night not booked yet', 'Add the hotel once it’s booked']]],
    ['2026-12-10', C.montreux, [['car', 'Drive around → Montreux', 'Scenic drive day'], ['hotel', 'Night not booked yet', 'Add the hotel once it’s booked']]],
    ['2026-12-11', C.colmar, [['car', 'Drive to Colmar, France', ''], ['hotel', 'Sleep in Colmar', 'Add the hotel booking']]],
    ['2026-12-12', C.strasbourg, [['car', 'Drive to Strasbourg', ''], ['hotel', 'Sleep in Strasbourg', 'Add the hotel booking']]],
    ['2026-12-13', C.paris, [['car', 'Return the rental car', 'Add the return details'], ['train', 'Train to Paris', 'Add the train ticket'], ['hotel', 'Sleep in Paris', 'Add the hotel booking']]],
    ['2026-12-14', C.paris, [['visit', 'Full day in Paris', ''], ['hotel', 'Sleep in Paris', '']]],
    ['2026-12-15', C.paris, [['flight', 'Mom: flight Paris → Tel Aviv', 'Separate ticket', 'Mom'], ['flight', 'Gal: flight Paris → Bangkok', 'Separate ticket', 'Gal']]]
  ];
  for (const [date, c, its] of plan) {
    await put('days', { tripId: id, date, ...c });
    let order = 0;
    for (const [kind, title, sub, who] of its) await put('items', { tripId: id, date, time: '', kind, title, sub, who: who || '', order: order++ });
  }
  const ideas = [
    ['Christmas market at Rathausplatz', 'market', C.vienna, 48.2108, 16.3575, 'Vienna\'s big town-hall market'],
    ['Salzburg Christkindlmarkt', 'market', C.salzburg, 47.798, 13.047, 'Domplatz & Residenzplatz'],
    ['Café Tomaselli', 'food', C.salzburg, 47.7996, 13.0437, 'Classic Salzburg coffee house'],
    ['Wienachtsdorf', 'market', C.zurich, 47.3663, 8.5458, 'Christmas village at Sechseläutenplatz'],
    ['Montreux Noël', 'market', C.montreux, 46.4325, 6.9105, 'Lakeside Christmas market'],
    ['Petite Venise', 'visit', C.colmar, 48.0738, 7.358, 'Canals and lights, best at dusk'],
    ['Christkindelsmärik', 'market', C.strasbourg, 48.5846, 7.7497, 'Place Broglie, one of the oldest markets'],
    ['Galeries Lafayette Christmas tree', 'visit', C.paris, 48.8738, 2.332, 'The giant tree under the dome']
  ];
  for (const [name, kind, c, lat, lon, note] of ideas) {
    await put('places', { tripId: id, name, kind, city: c.city, country: c.country, lat, lon, note, status: 'want', hours: '', parking: '', address: '', url: '', photo: '' });
  }
  const pack = ['Passports', 'Travel insurance papers', 'Warm coat & gloves', 'Power adapters (CH plug is different!)', 'Driving licence (for the car)', 'Euros + a few Swiss francs', 'Phone chargers & power bank'];
  for (const text of pack) await put('packing', { tripId: id, text, done: 0 });
  await setCurrentTrip(id);
  return id;
}

export function sortByDateTime(a, b) {
  return (a.date || '').localeCompare(b.date || '') || (a.time || '99').localeCompare(b.time || '99');
}

// Put a booking on the plan: attach it to the matching item for that day, or create one.
export async function attachTicketToPlan(t, items, tripId, itemId) {
  if (!t.date) return;
  const sub = [t.time && (t.kind === 'hotel' ? 'Check-in ' + t.time : t.time), t.kind === 'flight' && t.car, t.kind !== 'flight' && t.car && 'Car ' + t.car, t.seat && 'Seat ' + t.seat, t.kind === 'hotel' && t.endDate && 'until ' + fmtDateLong(t.endDate), t.confirmation && '#' + t.confirmation].filter(Boolean).join(' · ');
  const linked = items.find((i) => i.ticketId === t.id) || (itemId && items.find((i) => i.id === itemId)) ||
    items.find((i) => i.date === t.date && i.kind === t.kind && !i.ticketId && !i.deleted && (!t.who || !i.who || i.who === t.who));
  if (linked) await put('items', { ...linked, ticketId: t.id, title: t.title || linked.title, time: t.time || linked.time, sub, date: t.date, who: t.who || linked.who || '' });
  else await put('items', { tripId, date: t.date, time: t.time, kind: t.kind, title: t.title, sub, ticketId: t.id, who: t.who || '' });
}

// Bookings prepared by Claude: a .json file with the details and the files inside.
export async function importBookings(json, tripId, items, saveFile, rates, toEUR) {
  const data = JSON.parse(json);
  if (!data || !Array.isArray(data.tickets)) throw new Error('Not a TRIPPIN bookings file');
  let n = 0;
  let current = [...items];
  for (const raw of data.tickets) {
    const { files = [], ...fields } = raw;
    let fileId = null;
    for (const f of files) {
      const bin = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
      const blob = new File([bin], f.name, { type: f.type });
      const id = await saveFile(blob);
      if (!fileId) fileId = id;
    }
    const price = fields.price != null && fields.price !== '' ? Number(fields.price) : null;
    const t = await put('tickets', { ...fields, tripId, fileId, status: 'ok', price, priceEUR: price ? toEUR(price, fields.currency || 'EUR', rates) : 0 });
    await attachTicketToPlan(t, current, tripId);
    current = (await db.items.where('tripId').equals(tripId).toArray()).filter((i) => !i.deleted);
    n++;
  }
  return n;
}
