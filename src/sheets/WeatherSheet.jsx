import { useEffect, useState } from 'preact/hooks';
import { useApp } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { Sheet } from './Sheets.jsx';
import { getWeather, weatherText, weatherIcon } from '../lib/services.js';
import { todayStr, dow, fmtDate, dateRange, addDays } from '../lib/util.js';
import { dayInfo } from '../lib/trip.js';

export function WeatherSheet({ date }) {
  const { data } = useApp();
  const { days, trip } = data;
  const day = dayInfo(days, date);
  const [wx, setWx] = useState(null);
  const [ahead, setAhead] = useState([]);
  useEffect(() => {
    getWeather(day.lat, day.lon).then(setWx);
    (async () => {
      const out = [];
      for (const d of dateRange(addDays(date, 1), addDays(date, 5))) {
        const info = dayInfo(days, d);
        const lat = info.lat ?? day.lat, lon = info.lon ?? day.lon;
        const w = await getWeather(lat, lon);
        const i = w?.daily?.time?.indexOf(d);
        if (i != null && i >= 0) out.push({ d, city: info.city || day.city, code: w.daily.weather_code[i], max: Math.round(w.daily.temperature_2m_max[i]), min: Math.round(w.daily.temperature_2m_min[i]) });
      }
      setAhead(out);
    })();
  }, [date, day.lat]);

  const isToday = date === todayStr();
  const i = wx?.daily?.time?.indexOf(date) ?? -1;
  const has = i >= 0;
  const temp = isToday && wx?.current ? Math.round(wx.current.temperature_2m) : has ? Math.round(wx.daily.temperature_2m_max[i]) : null;
  const code = isToday && wx?.current ? wx.current.weather_code : has ? wx.daily.weather_code[i] : null;
  const hours = (wx?.hourly?.time || []).map((t, k) => ({ t, k })).filter(({ t }) => t.startsWith(date) && Number(t.slice(11, 13)) % 2 === 0 && Number(t.slice(11, 13)) >= 8).slice(0, 7);
  const tip = code != null && [71, 73, 75, 77, 85, 86].includes(code) ? 'Snow expected: boots and gloves.' : code != null && code >= 51 && code <= 82 ? 'Rain likely: take an umbrella.' : temp != null && temp <= 2 ? 'Cold day: dress in layers.' : '';

  return (
    <Sheet title={'Weather · ' + (day.city || '')}>
      {!wx && <div class="empty">{navigator.onLine ? 'Loading…' : 'No forecast saved yet. It downloads next time you’re online.'}</div>}
      {wx && !has && !isToday && <div class="empty">Forecasts reach about 16 days ahead. Check back closer to {fmtDate(date)}.</div>}
      {wx && (has || isToday) && (
        <>
          <div class="row" style={{ gap: '14px', marginTop: '8px' }}>
            <Icon name={weatherIcon(code)} size={64} stroke={1.2} style={{ color: 'var(--blue)' }} />
            <div>
              <div class="serif" style={{ fontSize: '60px', fontWeight: 600, lineHeight: 0.95 }}>{temp}°C</div>
              <div class="muted">{weatherText(code)}{isToday && wx.current ? ` · feels like ${Math.round(wx.current.apparent_temperature)}°` : ''}</div>
            </div>
          </div>
          {has && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: '8px', marginTop: '14px' }}>
              {[['High / low', `${Math.round(wx.daily.temperature_2m_max[i])}° / ${Math.round(wx.daily.temperature_2m_min[i])}°`], ['Rain/snow', (wx.daily.precipitation_probability_max[i] ?? '–') + '%'], ['Sunrise', (wx.daily.sunrise[i] || '').slice(11, 16)], ['Sunset', (wx.daily.sunset[i] || '').slice(11, 16)]].map(([k, v]) => (
                <div class="card" style={{ padding: '10px 6px', textAlign: 'center', boxShadow: 'none' }}><div class="muted" style={{ fontSize: '11px' }}>{k}</div><div style={{ fontWeight: 700, fontSize: '14px' }}>{v}</div></div>
              ))}
            </div>
          )}
          {hours.length > 0 && <>
            <div class="eyebrow" style={{ margin: '18px 0 8px' }}>Hour by hour</div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${hours.length}, minmax(0,1fr))`, gap: '6px' }}>
              {hours.map(({ t, k }) => (
                <div class="card" style={{ padding: '10px 0', textAlign: 'center', boxShadow: 'none' }}>
                  <div class="small">{t.slice(11, 13)}</div>
                  <Icon name={weatherIcon(wx.hourly.weather_code[k])} size={18} style={{ color: 'var(--blue)' }} />
                  <div style={{ fontWeight: 700 }}>{Math.round(wx.hourly.temperature_2m[k])}°</div>
                </div>
              ))}
            </div>
          </>}
          {tip && <div class="soft" style={{ padding: '10px 12px', marginTop: '14px', fontSize: '13px' }}>{tip}</div>}
        </>
      )}
      {ahead.length > 0 && <>
        <div class="eyebrow" style={{ margin: '18px 0 6px' }}>Next days · where you'll be</div>
        <div class="card" style={{ padding: '2px 14px', boxShadow: 'none' }}>
          {ahead.map((a) => (
            <div class="row" style={{ minHeight: '46px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ width: '64px', fontWeight: 600, fontSize: '13px' }}>{dow(a.d)} {fmtDate(a.d).split(' ')[0]}</span>
              <span class="muted" style={{ flex: 1, fontSize: '13px' }}>{a.city}</span>
              <Icon name={weatherIcon(a.code)} size={18} style={{ color: 'var(--blue)' }} />
              <span style={{ width: '70px', textAlign: 'right', fontWeight: 700, fontSize: '13px' }}>{a.max}° / {a.min}°</span>
            </div>
          ))}
        </div>
      </>}
      <div class="muted small" style={{ marginTop: '12px' }}>Forecast from Open-Meteo · saved for offline</div>
    </Sheet>
  );
}
