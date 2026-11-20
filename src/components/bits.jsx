import { useEffect, useState } from 'preact/hooks';
import Icon from './Icon.jsx';
import { dow, dayNum, money, todayStr } from '../lib/util.js';
import { findPhoto, getWeather, weatherIcon, getRates, fromEUR } from '../lib/services.js';
import { patch, fileURL } from '../lib/db.js';

export function DayStrip({ dates, days, selected, onPick, temps = {} }) {
  useEffect(() => {
    const el = document.querySelector('.day.on');
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [selected]);
  return (
    <div class="strip" role="tablist" aria-label="Trip days">
      {dates.map((d) => {
        const info = days.find((x) => x.date === d) || {};
        const city = (info.city || '').slice(0, 3).toUpperCase();
        return (
          <button role="tab" aria-selected={d === selected} class={'day' + (d === selected ? ' on' : '')} onClick={() => onPick(d)}
            aria-label={`${dow(d)} ${dayNum(d)}${info.city ? ', ' + info.city : ''}${temps[d] != null ? ', ' + temps[d] + '°C' : ''}`}>
            <span class="w">{dow(d)}</span>
            <span class="d">{dayNum(d)}</span>
            <span class="c">{city || '·'}</span>
            {temps[d] != null && <span class="t">{temps[d]}°</span>}
          </button>
        );
      })}
    </div>
  );
}

// Weather for a city: today's numbers + the per-day max for the strip.
export function useWeather(lat, lon) {
  const [wx, setWx] = useState(null);
  useEffect(() => { let on = true; setWx(null); getWeather(lat, lon).then((w) => on && setWx(w)); return () => { on = false; }; }, [lat, lon]);
  return wx;
}

// Temperatures for every trip day, each from that day's city.
export function useTripTemps(days) {
  const [temps, setTemps] = useState({});
  const key = days.map((d) => d.date + d.lat).join('|');
  useEffect(() => {
    let on = true;
    (async () => {
      const out = {};
      for (const d of days) {
        if (d.lat == null) continue;
        const w = await getWeather(d.lat, d.lon);
        const i = w?.daily?.time?.indexOf(d.date);
        if (i != null && i >= 0) out[d.date] = Math.round(w.daily.temperature_2m_max[i]);
      }
      if (on) setTemps(out);
    })();
    return () => { on = false; };
  }, [key]);
  return temps;
}

export function WeatherChip({ day, onOpen, dark }) {
  const wx = useWeather(day?.lat, day?.lon);
  const today = todayStr();
  let temp = null, code = null;
  if (wx) {
    if (day.date === today && wx.current) { temp = Math.round(wx.current.temperature_2m); code = wx.current.weather_code; }
    else { const i = wx.daily?.time?.indexOf(day.date); if (i >= 0) { temp = Math.round(wx.daily.temperature_2m_max[i]); code = wx.daily.weather_code[i]; } }
  }
  if (day?.lat == null) return null;
  return (
    <button onClick={onOpen} class="btn" aria-label={temp != null ? `Weather ${temp} degrees. Open weather details` : 'Open weather'}
      style={dark ? { background: 'rgba(255,255,255,0.12)', borderColor: 'transparent', color: '#fff', padding: '0 12px' } : { padding: '0 12px' }}>
      <Icon name={code != null ? weatherIcon(code) : 'cloud'} size={22} style={{ color: dark ? '#fff' : 'var(--blue)' }} />
      <span style={{ fontSize: '18px', fontWeight: 700 }}>{temp != null ? temp + '°' : '–'}</span>
    </button>
  );
}

// A place/booking photo: their own photo first, else a free Wikimedia photo found by name.
export function Photo({ place, height = 170, children, label }) {
  const [src, setSrc] = useState(place?.photo || '');
  useEffect(() => {
    let on = true;
    (async () => {
      if (place?.photoFile) { const u = await fileURL(place.photoFile); if (on && u) { setSrc(u); return; } }
      if (place?.photo) { setSrc(place.photo); return; }
      const q = place?.name ? `${place.name} ${place.city || ''}`.trim() : (place?.city || '');
      if (!q) return;
      let url = await findPhoto(q);
      if (!url && place?.city) url = await findPhoto(place.city);
      if (on && url) { setSrc(url); if (place?.id && place?._table) patch(place._table, place.id, { photo: url }); }
    })();
    return () => { on = false; };
  }, [place?.id, place?.name, place?.photo, place?.photoFile, place?.city]);
  return (
    <div class="hero" style={{ height: height + 'px' }}>
      {src ? <img src={src} alt={label || place?.name || ''} loading="lazy" onError={() => setSrc('')} /> : <div class="ph"><Icon name={place?.kind || 'pin'} size={40} stroke={1.3} /></div>}
      {children}
      {src && !place?.photoFile && <span class="credit">Photo: Wikimedia</span>}
    </div>
  );
}

export function KindIcon({ kind, size = 18, style, cls = 'ic' }) {
  return <span class={cls} style={style}><Icon name={kind} size={size} /></span>;
}

export function useRates() {
  const [r, setR] = useState(null);
  useEffect(() => { getRates().then(setR); }, []);
  return r;
}

export function Usd({ eur, rates }) {
  if (!rates || !eur) return null;
  return <span class="muted small"> ≈ {money(fromEUR(eur, 'USD', rates), 'USD', 0)}</span>;
}

export function Header({ title, back = true, right, eyebrow }) {
  return (
    <div>
      <div class="top" style={{ minHeight: '44px' }}>
        {back ? <button class="icon-btn" aria-label="Back" onClick={() => history.length > 1 ? history.back() : (location.hash = '#/today')}><Icon name="back" /></button> : <span />}
        {right || <span />}
      </div>
      {eyebrow && <div class="eyebrow" style={{ marginTop: '10px' }}>{eyebrow}</div>}
      <h1 class="h1" style={{ marginTop: eyebrow ? '4px' : '10px' }}>{title}</h1>
    </div>
  );
}
