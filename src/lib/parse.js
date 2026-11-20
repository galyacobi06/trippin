// Reads a booking PDF on the phone itself (nothing is sent anywhere) and guesses the details.
// You always get a review screen to check and fix them before saving.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export async function pdfText(file) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, 6); i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let line = '', lastY = null;
    const lines = [];
    for (const it of tc.items) {
      const y = it.transform ? Math.round(it.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 3) { lines.push(line.trim()); line = ''; }
      line += (line && !line.endsWith(' ') ? ' ' : '') + it.str;
      lastY = y;
    }
    lines.push(line.trim());
    pages.push(lines.filter(Boolean).join('\n'));
  }
  return pages.join('\n');
}

const MONTHS = {
  jan: 1, january: 1, januar: 1, janvier: 1, jänner: 1, feb: 2, february: 2, februar: 2, février: 2, fevrier: 2,
  mar: 3, march: 3, märz: 3, maerz: 3, mars: 3, apr: 4, april: 4, avril: 4, may: 5, mai: 5, jun: 6, june: 6, juni: 6, juin: 6,
  jul: 7, july: 7, juli: 7, juillet: 7, aug: 8, august: 8, août: 8, aout: 8, sep: 9, sept: 9, september: 9, septembre: 9,
  oct: 10, october: 10, oktober: 10, okt: 10, octobre: 10, nov: 11, november: 11, novembre: 11, dec: 12, december: 12, dezember: 12, dez: 12, décembre: 12, decembre: 12
};
const p2 = (n) => String(n).padStart(2, '0');

export function findDates(text, defaultYear) {
  const found = [];
  const add = (y, m, d, idx) => {
    y = Number(y); if (y < 100) y += 2000;
    m = Number(m); d = Number(d);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 2000 && y < 2100) found.push({ date: `${y}-${p2(m)}-${p2(d)}`, idx });
  };
  let m;
  const r1 = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = r1.exec(text))) add(m[1], m[2], m[3], m.index);
  const r2 = /\b(\d{1,2})[./](\d{1,2})[./](\d{2,4})\b/g;
  while ((m = r2.exec(text))) add(m[3], m[2], m[1], m.index);
  const r3 = /\b(\d{1,2})\.?\s+([A-Za-zäéû]{3,10})\.?,?\s+(\d{4})\b/g;
  while ((m = r3.exec(text))) { const mo = MONTHS[m[2].toLowerCase()]; if (mo) add(m[3], mo, m[1], m.index); }
  const r4 = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g;
  while ((m = r4.exec(text))) { const mo = MONTHS[m[1].toLowerCase()]; if (mo) add(m[3], mo, m[2], m.index); }
  if (defaultYear) {
    const r5 = /\b(\d{1,2})\.?\s+([A-Za-zäéû]{3,10})\b(?!\.?,?\s+\d{4})/g;
    while ((m = r5.exec(text))) { const mo = MONTHS[m[2].toLowerCase()]; if (mo) add(defaultYear, mo, m[1], m.index); }
  }
  return found.sort((a, b) => a.idx - b.idx);
}

export function findTimes(text) {
  const out = [];
  const r = /(?<![\d][./])\b([01]?\d|2[0-3])[:.h]([0-5]\d)\b(?![./]\d)(?!\s*(?:%|kg|km|€|eur|chf))/gi;
  let m;
  while ((m = r.exec(text))) out.push({ time: `${p2(m[1])}:${m[2]}`, idx: m.index });
  return out;
}

const has = (t, words) => words.some((w) => t.includes(w));

export function guessBooking(text, fileName = '', trip) {
  const t = (text || '').toLowerCase();
  const f = fileName.toLowerCase();
  let kind = 'event';
  if (has(t + f, ['öbb', 'oebb', 'sbb', 'cff', 'sncf', 'tgv', 'railjet', 'nightjet', 'deutsche bahn', 'trainline', 'ouigo', 'lyria', 'westbahn', ' ice ', 'wagen', 'voiture', 'coach ', 'gleis', 'platform', 'zug', 'train'])) kind = 'train';
  if (has(t + f, ['hertz', 'sixt', 'europcar', 'avis', 'enterprise', 'budget rent', 'car rental', 'rental car', 'mietwagen', 'pick-up', 'pickup location'])) kind = 'car';
  if (has(t + f, ['booking.com', 'airbnb', 'check-in', 'check in', 'check-out', 'hotel', 'night', 'nächte', 'nuits', 'guest', 'room'])) kind = kind === 'train' && !has(t, ['hotel', 'booking.com', 'airbnb']) ? kind : 'hotel';
  if (has(t + f, ['boarding', 'flight', 'gate', 'airline', 'el al', 'austrian airlines', 'lufthansa', 'swiss international', 'easyjet', 'ryanair', 'wizz'])) kind = 'flight';

  const year = trip?.start ? Number(trip.start.slice(0, 4)) : new Date().getFullYear();
  const dates = findDates(text || '', year);
  const inTrip = dates.filter((d) => !trip?.start || (d.date >= trip.start && d.date <= (trip.end || '9999')));
  const datePick = (inTrip[0] || dates[0])?.date || '';
  const times = findTimes(text || '');

  let confirmation = '';
  const spaced = (text || '').match(/(?:buchungscode|booking code|booking reference|confirmation (?:number|code)|reference code|reservation (?:number|code)|pnr)\s*[:#]?\s*(\d{3,4}(?: \d{3,4}){1,5})\b/i);
  const cm = (text || '').match(/(?:confirmation|booking|reservation|buchungs|order|pnr|dossier|référence|reference|auftrags)[\s-]*(?:number|no\.?|nr\.?|code|nummer|reference|ref\.?|id|#)?\s*[:#]?\s*((?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{4,19})/i);
  if (spaced) confirmation = spaced[1];
  else if (cm) confirmation = cm[1];

  const seat = ((text || '').match(/(?:seat|sitzplatz|platz|place|siège)\s*:?\s*(\d{1,3}[A-Z]?)/i) || [])[1] || '';
  let car = ((text || '').match(/(?:coach|car|wagen|voiture)\s*:?\s*(\d{1,3})\b/i) || [])[1] || '';
  const fno = (text || '').match(/flight (?:number|no\.?)\s*:?\s*([A-Z0-9]{2}\s?\d{2,4})/i);
  if (fno) car = fno[1];

  let from = '', to = '';
  const arrow = (text || '').match(/([A-ZÄÖÜ][\wäöüéèßÄÖÜ .'-]{2,40}?)(?:\s*\([^)\n]*)?\s*(?:→|->|–>|—|›|»|>)\s*([A-ZÄÖÜ][\wäöüéèß .'-]{2,40})/);
  const tidy = (x) => (x === x.toUpperCase() && x.length > 3 ? x.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase()) : x);
  if (arrow) { from = tidy(arrow[1].trim()); to = tidy(arrow[2].trim()); }
  else {
    const ft = (text || '').match(/\bfrom\s+([A-ZÄÖÜ][\wäöüéèß .'-]{2,40}?)\s+to\s+([A-ZÄÖÜ][\wäöüéèß .'-]{2,40})/);
    if (ft) { from = ft[1].trim(); to = ft[2].trim(); }
  }

  let title = '';
  const lines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (kind === 'hotel') title = lines.find((l) => /hotel|gasthof|pension|residence|apartment|inn\b|lodge/i.test(l) && l.length < 60) || '';
  if (kind === 'train' && from && to) title = `${from} → ${to}`;
  if (kind === 'flight' && from && to) title = `Flight ${from} → ${to}`;
  if (kind === 'car') title = (lines.find((l) => /hertz|sixt|europcar|avis|enterprise/i.test(l)) || 'Car rental').slice(0, 50);
  if (!title) title = fileName.replace(/\.(pdf|png|jpe?g|heic)$/i, '').replace(/[_-]+/g, ' ').slice(0, 60) || 'Booking';

  let endDate = '';
  if (kind === 'hotel' || kind === 'car') {
    const others = (inTrip.length > 1 ? inTrip : dates).map((d) => d.date).filter((d) => d > datePick);
    endDate = others[0] || '';
  }

  let time = '';
  if (kind === 'hotel') {
    const ci = (text || '').match(/check[- ]?in[^\n]{0,40}?(\d{1,2}[:.]\d{2})/i);
    time = ci ? ci[1].replace('.', ':').padStart(5, '0') : '15:00';
  } else {
    const dep = (text || '').match(/(?:departure|depart|abfahrt|départ|dep\.?|ab|um|time)\s*:?\s*(\d{1,2}[:.h]\d{2})/i);
    time = dep ? dep[1].replace(/[.h]/, ':').padStart(5, '0') : (times[0]?.time || '');
  }

  let price = '', currency = '';
  const pm = (text || '').match(/(?:total price|price|total|preis|gesamt|prix|montant|amount)[^\d€$\n]{0,20}?(EUR|CHF|USD|€|\$)?\s*([\d]{1,5}(?:[.,]\d{2})?)\s*(EUR|CHF|USD|€)?/i);
  if (pm && (pm[1] || pm[3])) {
    price = pm[2].replace(',', '.');
    const c = (pm[1] || pm[3] || '').toUpperCase();
    currency = c === '€' ? 'EUR' : c === '$' ? 'USD' : c;
  }

  const address = lines.find((l) => /\d{4,5}\s+[A-ZÄÖÜ][a-zäöüé]+/.test(l) && /(str|gasse|weg|platz|rue|street|avenue|allee|strasse|straße)/i.test(l)) || '';

  return { kind, title, date: datePick, time, endDate, confirmation, seat, car, from, to, address, price, currency };
}

// Calendar invites (.ics) from airlines and booking sites.
export function icsText(raw) {
  const unfolded = raw.replace(/\r?\n[ \t]/g, '');
  const get = (k) => (unfolded.match(new RegExp('^' + k + '(?:;[^:]*)?:(.*)$', 'm')) || [])[1] || '';
  const unesc = (v) => v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';');
  return { summary: unesc(get('SUMMARY')), description: unesc(get('DESCRIPTION')), location: unesc(get('LOCATION')), start: get('DTSTART') };
}
