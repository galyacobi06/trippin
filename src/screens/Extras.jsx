import { useState } from 'preact/hooks';
import { useApp, go } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { Header } from '../components/bits.jsx';
import { db, useLive, alive, put, patch, remove } from '../lib/db.js';
import { fmtDateLong, dateRange, localCurrency } from '../lib/util.js';
import { dayInfo, itemsOn } from '../lib/trip.js';

export function Packing() {
  const { data } = useApp();
  const items = alive(useLive(() => db.packing.where('tripId').equals(data.trip.id).toArray(), [data.trip.id], []));
  const [text, setText] = useState('');
  const add = async (e) => { e.preventDefault(); if (!text.trim()) return; await put('packing', { tripId: data.trip.id, text: text.trim(), done: 0 }); setText(''); };
  const sorted = [...items].sort((a, b) => a.done - b.done || (a.updatedAt - b.updatedAt));
  return (
    <div class="screen">
      <Header title="Packing list" eyebrow={`${items.filter((i) => i.done).length} of ${items.length} packed`} />
      <form onSubmit={add} class="row" style={{ marginTop: '14px' }}>
        <label for="newpack" class="sr" style={{ position: 'absolute', left: '-9999px' }}>New item</label>
        <input id="newpack" class="input" placeholder="Add something to pack" value={text} onInput={(e) => setText(e.currentTarget.value)} />
        <button class="btn btn-primary" type="submit">Add</button>
      </form>
      <div class="card" style={{ marginTop: '14px', padding: '4px 16px' }}>
        {sorted.map((i) => (
          <div class="between" style={{ minHeight: '52px', borderBottom: '1px solid var(--line)' }}>
            <label class="row" style={{ flex: 1, minHeight: '44px', textDecoration: i.done ? 'line-through' : 'none', color: i.done ? 'var(--done)' : 'inherit' }}>
              <input type="checkbox" class="check" checked={!!i.done} onChange={(e) => patch('packing', i.id, { done: e.currentTarget.checked ? 1 : 0 })} />{i.text}
            </label>
            <button class="icon-btn" style={{ border: 'none', background: 'none' }} aria-label={'Remove ' + i.text} onClick={() => remove('packing', i.id)}><Icon name="close" size={16} /></button>
          </div>
        ))}
        {!items.length && <div class="empty">Nothing yet.</div>}
      </div>
    </div>
  );
}

export function RouteScreen() {
  const { data, setSelDate, open } = useApp();
  const { trip, days, items } = data;
  const dates = dateRange(trip.start, trip.end);
  return (
    <div class="screen">
      <Header title="Route" eyebrow={trip.name} />
      <div style={{ marginTop: '14px' }}>
        {dates.map((d, i) => {
          const info = dayInfo(days, d);
          const its = itemsOn(items, d).filter((x) => ['train', 'flight', 'car', 'hotel'].includes(x.kind));
          return (
            <div class="tl-row">
              <div class="tl-rail">
                <div class="tl-dot" style={{ fontSize: '12px', fontWeight: 700 }}>{i + 1}</div>
                {i < dates.length - 1 && <div class="tl-line" />}
              </div>
              <button class="tl-body" onClick={() => { setSelDate(d); go('plan'); }}>
                <div class="muted small">{fmtDateLong(d)}</div>
                <div class="tl-title">{info.city || 'City not set'} <span class="muted small">{info.country ? '· ' + localCurrency(info.country) : ''}</span></div>
                <div class="muted small">{its.map((x) => x.title).join(' · ')}</div>
              </button>
              <button class="icon-btn" style={{ marginTop: '6px' }} aria-label={'Edit city for ' + fmtDateLong(d)} onClick={() => open('day', { date: d })}><Icon name="edit" size={16} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DEFAULT_EMERGENCY = 'Emergency (all of Europe): 112\nAustria police 133 · ambulance 144\nSwitzerland police 117 · ambulance 144\nFrance police 17 · ambulance 15\n\nTravel insurance: [company, policy number, phone]\nIsraeli embassy Vienna / Bern / Paris: [add numbers]';

export function Emergency() {
  const { data, toast } = useApp();
  const [text, setText] = useState(data.trip.emergency ?? DEFAULT_EMERGENCY);
  return (
    <div class="screen">
      <Header title="Emergency info" eyebrow="Works offline" />
      <a class="btn btn-primary btn-block" style={{ marginTop: '14px' }} href="tel:112"><Icon name="phone" size={18} />Call 112</a>
      <div class="field">
        <label for="em">Numbers & insurance (shared with Mom)</label>
        <textarea id="em" class="input" style={{ minHeight: '260px', lineHeight: 1.5 }} value={text} onInput={(e) => setText(e.currentTarget.value)} />
      </div>
      <button class="btn btn-block" style={{ marginTop: '12px' }} onClick={async () => { await patch('trips', data.trip.id, { emergency: text }); toast('Saved'); }}>Save</button>
      <div class="muted small" style={{ marginTop: '10px' }}>Please double-check the embassy and insurance numbers before you fly.</div>
    </div>
  );
}
