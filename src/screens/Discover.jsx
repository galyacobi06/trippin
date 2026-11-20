import { useEffect, useState } from 'preact/hooks';
import { useApp, go } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { Header, KindIcon } from '../components/bits.jsx';
import { discoverNearby, getPosition } from '../lib/services.js';
import { distanceKm, fmtDistance, todayStr, KINDS } from '../lib/util.js';
import { dayInfo, pickDefaultDate } from '../lib/trip.js';
import { put } from '../lib/db.js';

export function Discover() {
  const { data, selDate, toast } = useApp();
  const day = dayInfo(data.days, selDate || pickDefaultDate(data.trip));
  const [origin, setOrigin] = useState(null);
  const [list, setList] = useState(null);
  const [filter, setFilter] = useState('all');
  const [useGps, setUseGps] = useState(true);

  useEffect(() => {
    (async () => {
      let o = null;
      if (useGps) o = await getPosition();
      const inTripCity = o && day.lat != null && distanceKm(o, day) < 40;
      if (!o || (!inTripCity && day.lat != null)) o = day.lat != null ? { lat: day.lat, lon: day.lon, label: day.city } : o;
      setOrigin(o);
      if (!o) { setList([]); return; }
      const res = await discoverNearby(o.lat, o.lon);
      setList((res || []).map((p) => ({ ...p, km: distanceKm(o, p) })).sort((a, b) => a.km - b.km));
    })();
  }, [useGps, day.city]);

  const saved = new Set(data.places.map((p) => p.name.toLowerCase()));
  const shown = (list || []).filter((p) => filter === 'all' || p.kind === filter).slice(0, 40);
  const save = async (p) => {
    await put('places', { tripId: data.trip.id, name: p.name, kind: p.kind, city: day.city, country: day.country, lat: p.lat, lon: p.lon, hours: p.hours, url: p.website, status: 'want', note: '', parking: '', address: '' });
    toast('Saved to Want to see');
  };

  return (
    <div class="screen">
      <Header title="Discover" eyebrow={origin?.label ? 'Around ' + origin.label : 'Around you'} />
      <div class="seg" style={{ marginTop: '14px' }}>
        {[['all', 'All'], ['food', 'Food'], ['visit', 'Sights'], ['market', 'Markets']].map(([k, l]) => <button class={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}
      </div>
      {list === null && <div class="empty">Looking around…</div>}
      {list && !navigator.onLine && !list.length && <div class="empty">Discover needs internet. Your saved places still work offline.</div>}
      <div class="stack" style={{ marginTop: '12px' }}>
        {shown.map((p) => (
          <div class="list-item">
            <KindIcon kind={p.kind} />
            <div class="grow">
              <div class="title ellipsis">{p.name}</div>
              <div class="muted small ellipsis">{[KINDS[p.kind], fmtDistance(p.km), p.hours].filter(Boolean).join(' · ')}</div>
            </div>
            {saved.has(p.name.toLowerCase())
              ? <span class="small muted">Saved ✓</span>
              : <button class="btn btn-sm" onClick={() => save(p)}>+ Save</button>}
          </div>
        ))}
      </div>
      <div class="muted small" style={{ textAlign: 'center', marginTop: '14px' }}>Places from OpenStreetMap</div>
    </div>
  );
}
