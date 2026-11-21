import { useEffect, useState } from 'preact/hooks';
import { useApp, go } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { Photo, useRates, Usd } from '../components/bits.jsx';
import { fmtDate, money } from '../lib/util.js';
import { onSync } from '../lib/sync.js';
import { db, useLive, alive } from '../lib/db.js';

export function useSyncState() {
  const [s, setS] = useState({ status: 'off' });
  useEffect(() => onSync(setS), []);
  return s;
}

export function syncLabel(s) {
  return {
    off: 'On this device only · connect sync in Settings', 'signed-out': 'Sign in to sync with Mom', offline: 'Offline · everything is saved on this device',
    syncing: 'Syncing…', ok: 'Synced · saved offline', error: 'Sync problem · tap Settings'
  }[s.status] || '';
}

export function Trip() {
  const { data, mode, setMode, trips } = useApp();
  const { trip, days, places, tickets, expenses } = data;
  const rates = useRates();
  const sync = useSyncState();
  const packing = alive(useLive(() => db.packing.where('tripId').equals(trip.id).toArray(), [trip.id], []));
  const docs = alive(useLive(() => db.docs.toArray(), [], []));
  const route = [];
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) if (d.city && route[route.length - 1] !== d.city) route.push(d.city);
  const total = expenses.reduce((s, e) => s + (e.amountEUR || 0), 0) + tickets.reduce((s, t) => s + (t.priceEUR || 0), 0);
  const tiles = [
    ['euro', 'Expenses', total ? money(total) + ' so far' : 'Nothing logged yet', 'expenses'],
    ['pin', 'Places', `${places.filter((p) => p.status !== 'been').length} want to see · ${places.filter((p) => p.status === 'been').length} been`, 'plan'],
    ['lock', 'Documents', `${docs.length} saved · Face ID / PIN`, 'docs'],
    ['check', 'Packing list', `${packing.filter((p) => p.done).length} of ${packing.length} packed`, 'packing'],
    ['route', 'Route', `${route.length} cities · ${tickets.length} bookings`, 'route'],
    ['shield', 'Emergency info', '112 · insurance · embassy', 'emergency']
  ];
  return (
    <div class="screen">
      <div class="between">
        <h1 class="h1">Trip</h1>
        <button class="btn btn-sm" onClick={() => go('settings')}>Settings</button>
      </div>
      <div class="card navy" style={{ marginTop: '14px', overflow: 'hidden' }}>
        <Photo place={{ name: route[0] ? route.join(' ') : trip.name, city: route[1] || route[0] || '', kind: 'route', photo: trip.photo, id: trip.id, _table: 'trips', photoFile: trip.photoFile }} height={150} />
        <div style={{ padding: '14px 18px 16px' }}>
          <div class="serif" style={{ fontSize: '26px', fontWeight: 600 }}>{trip.name}</div>
          <div class="small" style={{ color: 'var(--on-navy-muted)', marginTop: '2px' }}>{fmtDate(trip.start)} – {fmtDate(trip.end)} · {route.join(' → ')}</div>
          <div class="row small" style={{ marginTop: '10px', color: '#E3D5BA', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '4px', background: sync.status === 'ok' ? '#7BC48F' : sync.status === 'error' ? '#E07A60' : '#C8A165' }} />{syncLabel(sync)}
          </div>
        </div>
      </div>
      <div class="grid2" style={{ marginTop: '16px' }}>
        {tiles.map(([icon, title, sub, to]) => (
          <a href={'#/' + to} class="card" style={{ padding: '14px', textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <span class="ic"><Icon name={icon} size={18} /></span>
            <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, marginTop: '10px' }}>{title}</span>
            <span class="muted small" style={{ display: 'block', marginTop: '2px' }}>{sub}</span>
          </a>
        ))}
      </div>
      <div class="eyebrow" style={{ margin: '22px 4px 8px' }}>Quick settings</div>
      <div class="card pad" style={{ paddingTop: '4px', paddingBottom: '4px' }}>
        <div class="between" style={{ minHeight: '54px', borderBottom: '1px solid var(--line)' }}>
          <span>Mode</span>
          <div class="seg" style={{ width: '220px' }}>
            {['light', 'dark', 'festive'].map((m) => <button class={mode === m ? 'on' : ''} onClick={() => setMode(m)} style={{ height: '32px', fontSize: '12px' }}>{m[0].toUpperCase() + m.slice(1)}</button>)}
          </div>
        </div>
        <a href="#/settings" class="between" style={{ minHeight: '54px', textDecoration: 'none', color: 'inherit' }}>
          <span>Sync, import, calendar & trips</span><Icon name="chev" size={16} />
        </a>
      </div>
      {rates && total > 0 && <div class="muted small" style={{ marginTop: '10px', textAlign: 'center' }}>Trip total {money(total)}<Usd eur={total} rates={rates} /></div>}
    </div>
  );
}
