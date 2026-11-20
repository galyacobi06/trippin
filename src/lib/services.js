// Free web services (no keys, no cost). Results are cached on the device for offline use.
import { getKV, setKV } from './db.js';

async function cached(key, maxAgeMs, fetcher) {
  const hit = await getKV('cache:' + key);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.value;
  if (!navigator.onLine) return hit ? hit.value : null;
  try {
    const value = await fetcher();
    if (value != null) await setKV('cache:' + key, { at: Date.now(), value });
    return value;
  } catch (e) {
    console.warn('service failed', key, e);
    return hit ? hit.value : null;
  }
}

async function json(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(r.status + ' ' + url);
  return r.json();
}

// ---------- Weather (Open-Meteo) ----------
const WMO = {
  0: ['Clear', 'sun'], 1: ['Mostly clear', 'sun'], 2: ['Partly cloudy', 'cloud'], 3: ['Cloudy', 'cloud'],
  45: ['Fog', 'cloud'], 48: ['Fog', 'cloud'], 51: ['Drizzle', 'rain'], 53: ['Drizzle', 'rain'], 55: ['Drizzle', 'rain'],
  61: ['Light rain', 'rain'], 63: ['Rain', 'rain'], 65: ['Heavy rain', 'rain'], 66: ['Freezing rain', 'rain'], 67: ['Freezing rain', 'rain'],
  71: ['Light snow', 'snow'], 73: ['Snow', 'snow'], 75: ['Heavy snow', 'snow'], 77: ['Snow grains', 'snow'],
  80: ['Showers', 'rain'], 81: ['Showers', 'rain'], 82: ['Heavy showers', 'rain'], 85: ['Snow showers', 'snow'], 86: ['Snow showers', 'snow'],
  95: ['Thunderstorm', 'rain'], 96: ['Thunderstorm', 'rain'], 99: ['Thunderstorm', 'rain']
};
export const weatherText = (code) => (WMO[code] || ['—', 'cloud'])[0];
export const weatherIcon = (code) => (WMO[code] || ['—', 'cloud'])[1];

export function getWeather(lat, lon) {
  if (lat == null || lon == null) return Promise.resolve(null);
  const key = `wx:${lat.toFixed(2)},${lon.toFixed(2)}`;
  return cached(key, 60 * 60 * 1000, () => json(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m' +
    '&hourly=temperature_2m,weather_code,precipitation_probability' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset' +
    '&timezone=auto&forecast_days=16'
  ));
}

// ---------- Places (OpenStreetMap) ----------
export async function searchPlace(q, near) {
  if (!q) return [];
  const vb = near ? `&viewbox=${near.lon - 0.3},${near.lat + 0.3},${near.lon + 0.3},${near.lat - 0.3}` : '';
  return (await cached('nom:' + q + vb, 30 * 86400000, () => json(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&extratags=1&limit=5&accept-language=en&q=${encodeURIComponent(q)}${vb}`
  ))) || [];
}

export async function reversePlace(lat, lon) {
  return cached(`rev:${lat.toFixed(4)},${lon.toFixed(4)}`, 30 * 86400000, () => json(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&extratags=1&accept-language=en&lat=${lat}&lon=${lon}`
  ));
}

export function cityOf(addr = {}) {
  return addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
}

// Nearest car parks around a place.
export async function nearbyParking(lat, lon) {
  const q = `[out:json][timeout:20];nwr(around:600,${lat},${lon})[amenity=parking];out center 6;`;
  const res = await cached(`park:${lat.toFixed(3)},${lon.toFixed(3)}`, 30 * 86400000, async () => {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) });
    if (!r.ok) throw new Error('overpass ' + r.status);
    return r.json();
  });
  return (res?.elements || []).map((e) => ({
    name: e.tags?.name || (e.tags?.parking === 'underground' ? 'Underground car park' : 'Car park'),
    fee: e.tags?.fee, lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon
  }));
}

// Discover: cafés, restaurants, sights and markets near you.
export async function discoverNearby(lat, lon) {
  const q = `[out:json][timeout:25];(
    nwr(around:1200,${lat},${lon})[amenity~"^(cafe|restaurant)$"][name];
    nwr(around:2000,${lat},${lon})[tourism~"^(attraction|museum|viewpoint)$"][name];
    nwr(around:2000,${lat},${lon})[historic~"^(castle|monument|church)$"][name];
    nwr(around:2500,${lat},${lon})[amenity=marketplace][name];
  );out center 60;`;
  const res = await cached(`disc:${lat.toFixed(3)},${lon.toFixed(3)}`, 7 * 86400000, async () => {
    const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) });
    if (!r.ok) throw new Error('overpass ' + r.status);
    return r.json();
  });
  return (res?.elements || []).map((e) => {
    const t = e.tags || {};
    const kind = t.amenity === 'cafe' || t.amenity === 'restaurant' ? 'food' : (t.amenity === 'marketplace' ? 'market' : 'visit');
    return { name: t['name:en'] || t.name, kind, hours: t.opening_hours || '', lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon, website: t.website || '' };
  }).filter((p) => p.name && p.lat);
}

// ---------- Photos (Wikipedia / Wikimedia Commons, free to reuse) ----------
export async function findPhoto(query) {
  if (!query) return null;
  return cached('photo:' + query, 90 * 86400000, async () => {
    const d = await json(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrlimit=3&gsrsearch=${encodeURIComponent(query)}&prop=pageimages&piprop=thumbnail&pithumbsize=900`);
    const pages = Object.values(d?.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    const p = pages.find((x) => x.thumbnail?.source);
    return p ? p.thumbnail.source : '';
  });
}

// ---------- Exchange rates (European Central Bank, via Frankfurter) ----------
const FALLBACK_RATES = { EUR: 1, USD: 1.16, CHF: 0.94, GBP: 0.86, ILS: 4.1 };
export async function getRates() {
  const r = await cached('rates', 12 * 3600000, async () => {
    let d;
    try { d = await json('https://api.frankfurter.dev/v1/latest?base=EUR'); }
    catch (e) { d = await json('https://api.frankfurter.app/latest?from=EUR'); }
    if (!d?.rates) return null;
    return { EUR: 1, ...d.rates, date: d.date };
  });
  return r || FALLBACK_RATES;
}
export const toEUR = (amount, cur, rates) => (cur === 'EUR' ? amount : amount / (rates[cur] || FALLBACK_RATES[cur] || 1));
export const fromEUR = (eur, cur, rates) => (cur === 'EUR' ? eur : eur * (rates[cur] || FALLBACK_RATES[cur] || 1));

// ---------- Google Maps links ----------
// Reads a place name and coordinates from a pasted Google Maps link (or plain text).
export function parseMapsLink(text) {
  const out = { url: '', name: '', lat: null, lon: null, address: '', short: false };
  const s = (text || '').trim();
  const urlMatch = s.match(/https?:\/\/\S+/);
  if (urlMatch) out.url = urlMatch[0];
  const rest = s.replace(out.url, '').trim();
  try {
    const u = new URL(out.url || 'x:');
    const path = decodeURIComponent(u.pathname).replace(/\+/g, ' ');
    const place = path.match(/\/place\/([^/]+)/);
    if (place) out.name = place[1];
    const q = u.searchParams.get('q') || u.searchParams.get('query') || u.searchParams.get('destination') || u.searchParams.get('name');
    const ll = (u.searchParams.get('ll') || u.searchParams.get('coordinate') || u.searchParams.get('sll') || '').match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
    if (ll) { out.lat = parseFloat(ll[1]); out.lon = parseFloat(ll[2]); }
    if (!out.name && q && !/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(q)) out.name = q;
    const at = u.href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || (u.pathname + u.search).match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const qcoord = (q || '').match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
    const c = at || qcoord;
    if (c && out.lat == null) { out.lat = parseFloat(c[1]); out.lon = parseFloat(c[2]); }
  } catch (e) { /* not a link */ }
  const restLines = rest.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!out.name && restLines[0]) out.name = restLines[0].slice(0, 120);
  if (restLines[1] && /\d/.test(restLines[1])) out.address = restLines[1].slice(0, 160);
  out.short = /(^|\.)goo\.gl$|maps\.app\.goo\.gl/i.test((() => { try { return new URL(out.url).hostname; } catch (e) { return ''; } })());
  return out;
}

// Google Takeout "Saved" lists come as CSV files (Title, Note, URL, ...).
export function parseTakeoutCSV(text) {
  const rows = [];
  let cur = [''], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cur[cur.length - 1] += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur[cur.length - 1] += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') cur.push('');
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; rows.push(cur); cur = ['']; }
    else cur[cur.length - 1] += ch;
  }
  if (cur.length > 1 || cur[0]) rows.push(cur);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (n) => head.indexOf(n);
  const iT = col('title'), iN = col('note'), iU = col('url'), iC = col('comment');
  return rows.slice(1).filter((r) => r.some((x) => x.trim())).map((r) => {
    const link = parseMapsLink(r[iU] || '');
    return { name: (r[iT] || link.name || '').trim(), note: [r[iN], r[iC]].filter(Boolean).join(' · ').trim(), url: r[iU] || '', lat: link.lat, lon: link.lon };
  }).filter((p) => p.name);
}

// ---------- Location ----------
let lastPos = null;
export function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(lastPos);
    navigator.geolocation.getCurrentPosition(
      (p) => { lastPos = { lat: p.coords.latitude, lon: p.coords.longitude, at: Date.now() }; setKV('lastPos', lastPos); resolve(lastPos); },
      async () => resolve(lastPos || (await getKV('lastPos'))),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 }
    );
  });
}

// Short Google Maps links (maps.app.goo.gl/...) are opened by our helper in Supabase, which returns the full link.
export async function resolveShortLink(url) {
  if (!navigator.onLine) return null;
  const { getClient } = await import('./sync.js');
  const c = await getClient();
  if (!c) return null;
  const { data, error } = await c.functions.invoke('resolve-link', { body: { url } });
  if (error || !data?.url) { console.warn('resolve-link', error || data); return null; }
  return data;
}
