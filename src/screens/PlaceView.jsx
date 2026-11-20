import { useEffect, useState } from 'preact/hooks';
import { useApp, go } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { Photo } from '../components/bits.jsx';
import { KINDS, mapsLink, wazeLink, distanceKm, travelHint, money } from '../lib/util.js';
import { getPosition, nearbyParking } from '../lib/services.js';
import { patch, remove } from '../lib/db.js';
import { dayInfo } from '../lib/trip.js';

export function PlaceView({ id }) {
  const { data, open, toast } = useApp();
  const p = data.places.find((x) => x.id === id);
  const [pos, setPos] = useState(null);
  const [parking, setParking] = useState(null);
  const [loadingPark, setLoadingPark] = useState(false);
  useEffect(() => { getPosition().then(setPos); }, []);
  if (!p) return <div class="screen"><button class="icon-btn" onClick={() => history.back()} aria-label="Back"><Icon name="back" /></button><div class="empty">This place was removed.</div></div>;

  const km = pos ? distanceKm(pos, p) : null;
  const spent = data.expenses.filter((e) => e.placeId === p.id).reduce((s, e) => s + (e.amountEUR || 0), 0);
  const findParking = async () => {
    if (p.lat == null) return toast('This place has no location yet');
    setLoadingPark(true);
    const res = await nearbyParking(p.lat, p.lon);
    setLoadingPark(false);
    setParking(res || []);
    if (res?.length) patch('places', p.id, { parking: res.slice(0, 3).map((r) => r.name + (r.fee === 'no' ? ' (free)' : r.fee === 'yes' ? ' (paid)' : '')).join(' · ') });
    else toast(navigator.onLine ? 'No car parks found close by' : 'Needs internet to search');
  };
  const dates = data.days.filter((d) => d.city === p.city).map((d) => d.date);

  return (
    <div style={{ paddingBottom: '120px' }}>
      <div style={{ position: 'relative' }}>
        <Photo place={{ ...p, _table: 'places' }} height={260} />
        <button class="icon-btn" aria-label="Back" style={{ position: 'absolute', left: '16px', top: 'calc(env(safe-area-inset-top) + 16px)', border: 'none', background: 'rgba(255,255,255,0.92)', color: '#1B2338' }} onClick={() => history.back()}><Icon name="back" /></button>
        <button class="icon-btn" aria-label="Edit place" style={{ position: 'absolute', right: '16px', top: 'calc(env(safe-area-inset-top) + 16px)', border: 'none', background: 'rgba(255,255,255,0.92)', color: '#1B2338' }} onClick={() => open('place', { place: p })}><Icon name="edit" /></button>
      </div>
      <div style={{ marginTop: '-26px', position: 'relative', background: 'var(--bg)', borderRadius: '28px 28px 0 0', padding: '22px 18px 0' }}>
        <div class="eyebrow" style={{ color: 'var(--accent-text)' }}>{KINDS[p.kind] || 'Place'}{p.city ? ' · ' + p.city : ''}</div>
        <h1 class="h1" style={{ marginTop: '4px' }}>{p.name}</h1>
        <div class="muted" style={{ fontSize: '13px', marginTop: '4px' }}>{[p.address, km != null && travelHint(km) + ' from you'].filter(Boolean).join(' · ')}</div>
        <div class="row" style={{ marginTop: '14px', gap: '8px' }}>
          <a class="btn btn-primary" style={{ flex: 1 }} href={mapsLink(p)} target="_blank" rel="noopener"><Icon name="nav" size={18} />Google Maps</a>
          <a class="btn" href={wazeLink(p)} target="_blank" rel="noopener">Waze</a>
          <button class="btn" onClick={() => open('item', { item: { placeId: p.id, kind: p.kind, title: p.name, date: dates[0] || data.trip.start } })}>Add to day</button>
        </div>
        <div class="card pad" style={{ marginTop: '14px', paddingTop: '4px', paddingBottom: '4px' }}>
          <div class="kv"><div class="k">Hours</div><div class="v">{p.hours || <span class="muted">Not saved yet. Tap edit to add, or paste them from the link.</span>}</div></div>
          <div class="kv"><div class="k">Getting there</div><div class="v">{p.gettingThere || (km != null ? travelHint(km) : <span class="muted">Opens directions in Google Maps or Waze</span>)}</div></div>
          <div class="kv"><div class="k">Parking</div><div class="v">
            {p.parking || (parking && !parking.length ? 'None found within 600 m' : '')}
            {!p.parking && <button class="link" disabled={loadingPark} onClick={findParking}>{loadingPark ? 'Searching…' : 'Find parking nearby'}</button>}
          </div></div>
          {p.url && <div class="kv"><div class="k">Link</div><div class="v"><a href={p.url} target="_blank" rel="noopener">Open saved link</a></div></div>}
          {spent > 0 && <div class="kv"><div class="k">Spent here</div><div class="v">{money(spent)}</div></div>}
        </div>
        {p.note && (
          <div class="soft" style={{ padding: '14px 16px', marginTop: '14px' }}>
            <div class="eyebrow">Our note</div>
            <div class="serif" style={{ fontSize: '20px', lineHeight: 1.25, marginTop: '4px' }}>{p.note}</div>
          </div>
        )}
        <div class="between" style={{ marginTop: '14px' }}>
          <label class="row" style={{ minHeight: '44px', fontWeight: 500 }}>
            <input type="checkbox" class="check" checked={p.status === 'been'} onChange={(e) => patch('places', p.id, { status: e.currentTarget.checked ? 'been' : 'want' })} />We've been here
          </label>
          <button class="btn btn-sm" style={{ color: 'var(--gold-text)' }} onClick={() => open('expense', { placeId: p.id, where: p.name, city: p.city })}>+€ Expense</button>
        </div>
        <button class="btn btn-ghost btn-block" style={{ marginTop: '18px', color: 'var(--accent-text)' }} onClick={async () => { if (confirm('Remove this place?')) { await remove('places', p.id); go('plan'); } }}><Icon name="trash" size={16} />Remove place</button>
      </div>
    </div>
  );
}
