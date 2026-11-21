import { useState } from 'preact/hooks';
import Icon from '../components/Icon.jsx';
import { seedChristmasTrip, createTrip } from '../lib/trip.js';
import { go, useApp } from '../app.jsx';
import { useSyncState, syncLabel } from './Trip.jsx';
import { syncNow } from '../lib/sync.js';

export function Welcome() {
  const { open } = useApp();
  const sync = useSyncState();
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState(false);
  const [f, setF] = useState({ name: '', start: '', end: '' });
  return (
    <div class="screen" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 60px)' }}>
      <div class="brand">TRIPPIN</div>
      <h1 class="h1" style={{ fontSize: '44px', marginTop: '18px' }}>All our trips,<br />in one place.</h1>
      <p class="muted" style={{ marginTop: '12px', lineHeight: 1.5 }}>Tickets, plans, places and expenses. Works with no signal. Shared between Gal and Mom.</p>
      <button class="btn btn-primary btn-block" style={{ marginTop: '28px', height: '54px' }} disabled={busy} onClick={async () => { setBusy(true); await seedChristmasTrip(); go('today'); }}>
        <Icon name="market" size={18} />Set up Christmas 2026 (6–15 Dec)
      </button>
      <p class="muted small" style={{ marginTop: '8px' }}>Vienna → Salzburg → Zurich → Montreux → Colmar → Strasbourg → Paris</p>
      {sync.email ? (
        <div class="card pad" style={{ marginTop: '14px' }}>
          <div class="small"><b>Signed in as {sync.email}</b></div>
          <div class="small muted" style={{ marginTop: '4px' }}>{sync.error || (sync.status === 'syncing' ? 'Downloading…' : 'No trip found online yet. Make sure Gal’s phone says “Synced” in Trip → Settings.')}</div>
          <button class="btn btn-sm" style={{ marginTop: '10px' }} onClick={() => syncNow()}>Try again</button>
        </div>
      ) : <button class="btn btn-block" style={{ marginTop: '14px' }} onClick={() => open('signin')}>Already set up on another device? Sign in</button>}
      <div class="muted small" style={{ textAlign: 'center', marginTop: '18px' }}>Version {__BUILD__}</div>
      {!custom ? <button class="btn btn-ghost btn-block" style={{ marginTop: '8px' }} onClick={() => setCustom(true)}>Start a different trip</button> : (
        <div class="card pad" style={{ marginTop: '14px' }}>
          <div class="field" style={{ marginTop: 0 }}><label for="wn">Trip name</label><input id="wn" class="input" value={f.name} onInput={(e) => setF({ ...f, name: e.currentTarget.value })} /></div>
          <div class="two">
            <div class="field"><label for="ws">First day</label><input id="ws" class="input" type="date" value={f.start} onInput={(e) => setF({ ...f, start: e.currentTarget.value })} /></div>
            <div class="field"><label for="we">Last day</label><input id="we" class="input" type="date" value={f.end} onInput={(e) => setF({ ...f, end: e.currentTarget.value })} /></div>
          </div>
          <button class="btn btn-primary btn-block" style={{ marginTop: '12px' }} disabled={!f.name || !f.start || !f.end || f.end < f.start} onClick={async () => { await createTrip(f); go('today'); }}>Create trip</button>
        </div>
      )}
    </div>
  );
}
