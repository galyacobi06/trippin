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
  ינו: 1, ינואר: 1, פבר: 2, פברואר: 2, מרץ: 3, אפר: 4, אפריל: 4, מאי: 5, יונ: 6, יוני: 6, יול: 7, יולי: 7, אוג: 8, אוגוסט: 8, ספט: 9, ספטמבר: 9, אוק: 10, אוקטובר: 10, נוב: 11, נובמבר: 11, דצמ: 12, דצמבר: 12,
  oct: 10, october: 10, oktober: 10, okt: 10, octobre: 10, nov: 11, november: 11, novembre: 11, dec: 12, december: 12, dezember: 12, dez: 12, décembre: 12, decembre: 12
};
const p2 = (n) => String(n).padStart(2, '0');

export function findDates(text, defaultYear) {
  text = (text || '').replace(/([\u05D0-\u05EA])['"׳״]/g, '$1'); // Hebrew abbreviations: דצמ' → דצמ
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
  const r3 = /(?<![\d])(\d{1,2})\.?\s+([A-Za-zäéû\u05D0-\u05EA]{3,10})\.?,?\s+(\d{4})\b/g;
  while ((m = r3.exec(text))) { const mo = MONTHS[m[2].toLowerCase()]; if (mo) add(m[3], mo, m[1], m.index); }
  const r4 = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g;
  while ((m = r4.exec(text))) { const mo = MONTHS[m[1].toLowerCase()]; if (mo) add(m[3], mo, m[2], m.index); }
  if (defaultYear) {
    const r6 = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})\b(?!\s*[:.]\d)/g;
    while ((m = r6.exec(text))) { const mo = MONTHS[m[1].toLowerCase()]; if (mo && m[1].length >= 3 && !/^may$/i.test(m[1])) add(defaultYear, mo, m[2], m.index); }
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


const AIRPORTS = {
  TLV: 'Tel Aviv', VIE: 'Vienna', CDG: 'Paris', ORY: 'Paris', BVA: 'Paris', BKK: 'Bangkok', DMK: 'Bangkok', ZRH: 'Zurich', GVA: 'Geneva', BSL: 'Basel', SZG: 'Salzburg',
  INN: 'Innsbruck', MUC: 'Munich', FRA: 'Frankfurt', SXB: 'Strasbourg', LHR: 'London', LGW: 'London', STN: 'London', AMS: 'Amsterdam', FCO: 'Rome', MXP: 'Milan', LIN: 'Milan',
  BCN: 'Barcelona', MAD: 'Madrid', LIS: 'Lisbon', IST: 'Istanbul', SAW: 'Istanbul', ATH: 'Athens', LCA: 'Larnaca', PFO: 'Paphos', DXB: 'Dubai', AUH: 'Abu Dhabi', DOH: 'Doha',
  JFK: 'New York', EWR: 'New York', BER: 'Berlin', PRG: 'Prague', BUD: 'Budapest', WAW: 'Warsaw', CPH: 'Copenhagen', BRU: 'Brussels', NCE: 'Nice', LYS: 'Lyon', MRS: 'Marseille',
  HKT: 'Phuket', CNX: 'Chiang Mai', USM: 'Koh Samui', SIN: 'Singapore', HKG: 'Hong Kong', NRT: 'Tokyo', HND: 'Tokyo', DEL: 'Delhi', BOM: 'Mumbai', ETM: 'Eilat'
};
const AIRLINES = { OS: 'Austrian Airlines', LX: 'SWISS', LH: 'Lufthansa', LY: 'El Al', TG: 'Thai Airways', AF: 'Air France', KL: 'KLM', BA: 'British Airways', IZ: 'Arkia', '6H': 'Israir', U2: 'easyJet', FR: 'Ryanair', W6: 'Wizz Air', TK: 'Turkish Airlines', EK: 'Emirates', QR: 'Qatar Airways', EY: 'Etihad' };
const HEB_CITY = { 'תל אביב': 'TLV', 'נתב"ג': 'TLV', 'פריז': 'CDG', 'וינה': 'VIE', 'בנגקוק': 'BKK', 'ציריך': 'ZRH', 'ז\'נבה': 'GVA', 'מינכן': 'MUC', 'פרנקפורט': 'FRA', 'לונדון': 'LHR', 'רומא': 'FCO', 'מילאנו': 'MXP', 'ברצלונה': 'BCN', 'אתונה': 'ATH', 'לרנקה': 'LCA', 'אילת': 'ETM', 'ברלין': 'BER', 'פראג': 'PRG', 'בודפשט': 'BUD', 'אמסטרדם': 'AMS', 'דובאי': 'DXB', 'ניו יורק': 'JFK', 'זלצבורג': 'SZG', 'שטרסבורג': 'SXB' };
export const airportCity = (code) => AIRPORTS[(code || '').toUpperCase()] || '';

// Apps often show labels on one line and their values on the next ("Flight  Booking Ref.  Class" / "TG933  5M9P7O  Business").
function columns(lines) {
  const out = {};
  const LABELS = [['flight', /^flight(?: no\.?| number)?$/i], ['ref', /^(?:booking ref\.?|booking reference|ref(?:erence)?\.?|pnr|confirmation)$/i], ['class', /^(?:class|cabin)$/i], ['seat', /^seats?$/i], ['gate', /^gate$/i], ['coach', /^(?:coach|car|wagen)$/i], ['terminal', /^terminal$/i]];
  for (let i = 0; i < lines.length - 1; i++) {
    const parts = lines[i].split(/\s{2,}|\t| (?=(?:Booking|Class|Seat|Gate|Coach|Terminal|Cabin)\b)/).map((x) => x.trim()).filter(Boolean);
    const keys = parts.map((p) => (LABELS.find(([, re]) => re.test(p)) || [])[0]);
    if (keys.length < 2 || keys.some((k) => !k)) continue;
    const vals = lines[i + 1].split(/\s+/).filter((v) => v.length > 0 && !/^[|l]$/.test(v));
    if (vals.length < keys.length) continue;
    keys.forEach((k, j) => { if (!out[k]) out[k] = vals[j]; });
  }
  return out;
}

const has = (t, words) => words.some((w) => t.includes(w));

export function guessBooking(text, fileName = '', trip) {
  const t = (text || '').toLowerCase();
  const f = fileName.toLowerCase();
  let kind = 'event';
  if (has(t + f, ['רכבת', 'קרון', 'öbb', 'oebb', 'sbb', 'cff', 'sncf', 'tgv', 'railjet', 'nightjet', 'deutsche bahn', 'trainline', 'ouigo', 'lyria', 'westbahn', ' ice ', 'wagen', 'voiture', 'coach ', 'gleis', 'platform', 'zug', 'train'])) kind = 'train';
  if (has(t + f, ['hertz', 'sixt', 'europcar', 'avis', 'enterprise', 'budget rent', 'car rental', 'rental car', 'mietwagen', 'pick-up', 'pickup location'])) kind = 'car';
  if (has(t + f, ['מלון', 'צ\'ק אאוט', 'לילות', 'booking.com', 'airbnb', 'check-in', 'check in', 'check-out', 'hotel', 'night', 'nächte', 'nuits', 'guest', 'room'])) kind = kind === 'train' && !has(t, ['hotel', 'booking.com', 'airbnb']) ? kind : 'hotel';
  if (has(t + f, ['טיסה', 'הטיסה', 'שער עלייה', 'כרטיס עלייה', 'אל על', 'boarding', 'flight', 'gate', 'airline', 'el al', 'austrian airlines', 'lufthansa', 'swiss international', 'easyjet', 'ryanair', 'wizz'])) kind = 'flight';

  const year = trip?.start ? Number(trip.start.slice(0, 4)) : new Date().getFullYear();
  const dates = findDates(text || '', year);
  const within = (d) => !trip?.start || (d >= trip.start && d <= (trip.end || '9999'));
  // Screenshot readers often drop a leading "1" ("15 Dec" → "5 Dec"): fix it when that lands inside the trip.
  for (const d of dates) {
    if (within(d.date)) continue;
    const day = Number(d.date.slice(8));
    const fixed = day < 10 ? d.date.slice(0, 8) + String(day + 10) : null;
    if (fixed && within(fixed) && !dates.some((x) => within(x.date))) d.date = fixed;
  }
  const inTrip = dates.filter((d) => within(d.date));
  const datePick = (inTrip[0] || dates[0])?.date || '';
  const rawLines = (text || '').split('\n');
  const statusClock = (rawLines.slice(0, 2).join(' ').match(/\b(\d{1,2}:\d{2})\b/) || [])[1];
  const times = findTimes(text || '').filter((x) => {
    const line = rawLines.find((l) => l.includes(x.time)) || '';
    return x.time !== statusClock && !/°/.test(line) && !/opens in|נפתח|יפתח/i.test(line);
  });

  let confirmation = '';
  const spaced = (text || '').match(/(?:buchungscode|booking code|booking reference|confirmation (?:number|code)|reference code|reservation (?:number|code)|pnr)\s*[:#]?\s*(\d{3,4}(?: \d{3,4}){1,5})\b/i);
  const cm = (text || '').match(/(?:confirmation|booking|reservation|buchungs|order|pnr|dossier|référence|reference|auftrags)[\s-]*(?:number|no\.?|nr\.?|code|nummer|reference|ref\.?|id|#)?\s*[:#]?\s*((?=[A-Z0-9-]*\d)[A-Z0-9][A-Z0-9-]{4,19})/i);
  const heb = (text || '').match(/(?:מס['׳]?\s*הזמנה|מספר הזמנה|קוד הזמנה|אסמכתא|מספר אישור)\s*[:#]?\s*[\u200e\u200f]?([A-Z0-9]{5,10})/);
  if (heb) confirmation = heb[1];
  else if (spaced) confirmation = spaced[1];
  else if (cm) confirmation = cm[1];

  let seat = ((text || '').match(/(?:seat|sitzplatz|platz|place|siège)\s*:?\s*(\d{1,3}[A-Z]?)/i) || [])[1] || '';
  let car = ((text || '').match(/(?:coach|car|wagen|voiture)\s*:?\s*(\d{1,3})\b/i) || [])[1] || '';
  const fno = (text || '').match(/flight (?:number|no\.?)\s*:?\s*([A-Z0-9]{2}\s?\d{2,4})/i);
  if (fno) car = fno[1];
  if (!car || /^\d+$/.test(car)) {
    const anyF = (text || '').match(new RegExp('\\b(' + Object.keys(AIRLINES).join('|') + ')\\s?(\\d{2,4})\\b'));
    if (anyF && (kind === 'flight' || /\b[A-Z]{3}\b/.test(text))) car = anyF[1] + anyF[2];
  }

  let from = '', to = '';
  const arrow = (text || '').match(/([A-ZÄÖÜ][\wäöüéèßÄÖÜ .'-]{2,40}?)(?:\s*\([^)\n]*)?\s*(?:→|->|–>|—|›|»|>)\s*([A-ZÄÖÜ][\wäöüéèß .'-]{2,40})/);
  const tidy = (x) => (x === x.toUpperCase() && x.length > 3 ? x.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase()) : x);
  if (arrow) { from = tidy(arrow[1].trim()); to = tidy(arrow[2].trim()); }
  else {
    const ft = (text || '').match(/\bfrom\s+([A-ZÄÖÜ][\wäöüéèß .'-]{2,40}?)\s+to\s+([A-ZÄÖÜ][\wäöüéèß .'-]{2,40})/);
    if (ft) { from = ft[1].trim(); to = ft[2].trim(); }
  }

  const lines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const col = columns(lines);
  let note = '';
  if (kind === 'flight' || col.flight) {
    if (col.flight) car = col.flight;
    if (col.ref && !confirmation) confirmation = col.ref;
    if (col.ref && /^[A-Z0-9]{5,8}$/i.test(col.ref)) confirmation = col.ref;
    if (col.seat) seat = col.seat;
    // Airport codes, e.g. "CDG ... BKK".
    const codes = [];
    for (const l of lines) for (const m2 of l.matchAll(/\b([A-Z]{3})\b/g)) if (AIRPORTS[m2[1]] && !codes.includes(m2[1])) codes.push(m2[1]);
    for (const [name, code] of Object.entries(HEB_CITY)) if ((text || '').includes(name) && !codes.includes(code) && codes.length < 2 && !codes.some((c) => AIRPORTS[c] === AIRPORTS[code])) codes.push(code);
    const isHeb = /[\u05D0-\u05EA]{3,}/.test(text || '');
    // In Hebrew apps "TLV ← CDG" reads right to left: from Paris to Tel Aviv.
    const pairLine = lines.find((l) => { const c = l.match(/\b[A-Z]{3}\b/g) || []; return c.filter((x) => AIRPORTS[x]).length >= 2; });
    if (pairLine && codes.length >= 2) {
      const c = pairLine.match(/\b[A-Z]{3}\b/g).filter((x) => AIRPORTS[x]);
      codes.splice(0, codes.length, ...(isHeb || /←/.test(pairLine) ? [c[1], c[0]] : [c[0], c[1]]));
    }
    // "to Tel Aviv" / "לתל אביב" settles which one is the destination.
    const dest = codes.find((c) => new RegExp('(?:\\bto\\s+|ל)' + Object.entries(HEB_CITY).filter(([, v]) => v === c).map(([k]) => k).concat(AIRPORTS[c]).join('|(?:\\bto\\s+|ל)'), 'i').test(text || ''));
    if (dest && codes.length >= 2 && codes[0] === dest) codes.reverse();
    if (codes.length >= 2 && (!from || !to || /^[A-Z]{3}$/.test(from) || isHeb)) { from = `${AIRPORTS[codes[0]]} (${codes[0]})`; to = `${AIRPORTS[codes[1]]} (${codes[1]})`; }
    else if (/^[A-Z]{3}$/.test(from) && AIRPORTS[from]) { from = `${AIRPORTS[from]} (${from})`; if (AIRPORTS[to]) to = `${AIRPORTS[to]} (${to})`; }
    const term = (text || '').match(/terminal\s*:?\s*([0-9A-Z]{1,2})\b/i);
    if (term && from && !/terminal/i.test(from)) from += `, Terminal ${term[1]}`;
    const airline = AIRLINES[(car.match(/^([A-Z0-9]{2})/) || [])[1]];
    let arr = (text || '').match(/(?:arrival|arrives?|lands?)[\s\S]{0,60}?\b(\d{1,2}:\d{2})\b/i);
    if (!arr && times[1]) arr = [null, times[1].time];
    note = [airline && `${airline} ${car}`, col.class && col.class + ' class', arr && 'lands ' + arr[1]].filter(Boolean).join(' · ');
    if (kind !== 'flight') kind = 'flight';
  }
  let title = '';
  if (kind === 'hotel') {
    const at = (text || '').match(/(?:booking|reservation|stay) at\s+([\s\S]{3,70}?)\s+(?:is|has been)\s+confirmed/i);
    const brand = lines.find((l) => /(novotel|ibis|mercure|sofitel|pullman|marriott|hilton|hyatt|radisson|holiday inn|motel one|meininger|b&b hotel|nh |premier inn|best western|intercontinental|sheraton|moxy|ruby )/i.test(l) && l.length < 60);
    const generic = lines.find((l) => /hotel|gasthof|pension|residence|apartment|inn\b|lodge/i.test(l) && l.length < 60 && !/hotel address|hotels?and|booking/i.test(l));
    title = at ? at[1].replace(/\s+/g, ' ').trim() : brand ? brand.replace(/^hotel\s+(?=(novotel|ibis|mercure|sofitel|pullman|marriott|hilton|hyatt|radisson|holiday inn|motel one|meininger|nh |premier inn|best western|intercontinental|sheraton|moxy|ruby ))/i, '').trim() : (generic || '').trim();
  }
  if (kind === 'train' && from && to) title = `${from} → ${to}`;
  if (kind === 'flight' && from && to) title = `Flight ${from.replace(/ \(.*$/, '')} → ${to.replace(/ \(.*$/, '')}`;
  if (kind === 'car') title = (lines.find((l) => /hertz|sixt|europcar|avis|enterprise/i.test(l)) || 'Car rental').slice(0, 50);
  if (!title) {
    const base = fileName.replace(/\.(pdf|png|jpe?g|heic|webp|ics)$/i, '');
    const generic = /^(img|image|screenshot|photo|scan|file|document|download)\b|^[0-9a-f-]{6,}\b|^\d+$/i.test(base);
    title = generic ? '' : base.replace(/[_-]+/g, ' ').slice(0, 60);
  }

  let endDate = '';
  if (kind === 'hotel' || kind === 'car') {
    const others = (inTrip.length > 1 ? inTrip : dates).map((d) => d.date).filter((d) => d > datePick);
    endDate = others[0] || '';
  }

  let time = '';
  if (kind === 'hotel') {
    const ci = (text || '').match(/check[- ]?in[\s\S]{0,40}?\b(\d{1,2}[:.]\d{2})\b/i);
    time = ci ? ci[1].replace('.', ':').padStart(5, '0') : '15:00';
  } else {
    const dep = (text || '').match(/(?:departure|depart|abfahrt|départ|dep\.?|ab|um|time)\s*:?\s*(\d{1,2}[:.h]\d{2})/i);
    time = dep ? dep[1].replace(/[.h]/, ':').padStart(5, '0') : (times[0]?.time || '');
  }

  let price = '', currency = '';
  const priceRe = /(?:total due|total price|price|total|preis|gesamtbetrag|gesamt|prix|montant|amount)[^\d€$\n]{0,20}?(EUR|CHF|USD|€|\$)?\s*([\d]{1,5}(?:[.,]\d{2})?)\s*(EUR|CHF|USD|€)?/gi;
  for (const pm of (text || '').matchAll(priceRe)) {
    if (!(pm[1] || pm[3])) continue;
    price = pm[2].replace(',', '.');
    const c = (pm[1] || pm[3] || '').toUpperCase();
    currency = c === '€' ? 'EUR' : c === '$' ? 'USD' : c;
    break;
  }


  let address = kind === 'train' || kind === 'flight' ? '' : lines.find((l) => /\d{4,5}\s+[A-ZÄÖÜ][a-zäöüé]+/.test(l) && /(str|gasse|weg|platz|rue|street|avenue|allee|strasse|straße)/i.test(l)) || '';

  if (!address && (kind === 'hotel' || kind === 'car' || kind === 'event')) {
    const st = (text || '').match(/([A-ZÄÖÜ][\wäöüß-]*(?:strasse|straße|gasse|weg|platz|allee|ring|kai|street|road|avenue)|(?:rue|avenue|boulevard|place|quai) [\wéèàç' -]{2,30}?)\b[\s\S]{0,25}?\b(\d{1,4}[a-z]?)\b/i);
    if (st) {
      const pc = (text || '').slice(st.index, st.index + 80).match(/\b(\d{4,5})\b(?!\s*(?:miles|%))/);
      address = st[1] + ' ' + st[2] + (pc && pc[1] !== st[2] ? ', ' + pc[1] : '');
    }
  }

  return { kind, title, date: datePick, time, endDate, confirmation, seat, car, from, to, address, price, currency, note };
}

// Calendar invites (.ics) from airlines and booking sites.
export function icsText(raw) {
  const unfolded = raw.replace(/\r?\n[ \t]/g, '');
  const get = (k) => (unfolded.match(new RegExp('^' + k + '(?:;[^:]*)?:(.*)$', 'm')) || [])[1] || '';
  const unesc = (v) => v.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';');
  return { summary: unesc(get('SUMMARY')), description: unesc(get('DESCRIPTION')), location: unesc(get('LOCATION')), start: get('DTSTART') };
}
