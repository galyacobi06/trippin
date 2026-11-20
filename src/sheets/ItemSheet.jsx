import { useState } from 'preact/hooks';
import { useApp, go } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { Sheet, Chips, Field } from './Sheets.jsx';
import { put, remove, patch } from '../lib/db.js';
import { searchPlace, cityOf } from '../lib/services.js';
import { KINDS, dateRange, fmtDateLong, mapsLink, isBooking } from '../lib/util.js';
import { dayInfo } from '../lib/trip.js';

const ITEM_KINDS = ['food', 'market', 'visit', 'train', 'flight', 'hotel', 'car', 'event', 'transport', 'gift', 'other'];

export function ItemSheet({ item }) {
  const { data, close, open, toast } = useApp();
  const { trip, places, tickets, days } = data;
  const isNew = !item?.id;
  const [edit, setEdit] = useState(isNew);
  const [f, setF] = useState({ kind: 'visit', title: '', time: '', sub: '', note: '', who: '', ...item, date: item?.date || trip.start });
  const set = (k) => (e) => setF({ ...f, [k]: e?.currentTarget ? e.currentTarget.value : e });
  const place = f.placeId && places.find((p) => p.id === f.placeId);
  const ticket = f.ticketId && tickets.find((t) => t.id === f.ticketId);
  const dates = dateRange(trip.start, trip.end);

  const save = async () => { await put('items', { ...f, tripId: trip.id }); toast(isNew ? 'Added to ' + fmtDateLong(f.date) : 'Saved'); close(); };

  if (!edit) {
    return (
      <Sheet title={f.title}>
        <div class="muted" style={{ marginTop: '4px' }}>{[fmtDateLong(f.date), f.time, KINDS[f.kind], f.who && 'for ' + f.who].filter(Boolean).join(' · ')}</div>
        {f.sub && <div style={{ marginTop: '10px' }}>{f.sub}</div>}
        {f.note && <div class="soft" style={{ padding: '10px 12px', marginTop: '10px' }}>{f.note}</div>}
        <div class="stack" style={{ marginTop: '16px' }}>
          {ticket && <button class="btn btn-gold btn-block" onClick={() => { close(); go('ticket/' + ticket.id); }}><Icon name="qr" size={18} />Show ticket</button>}
          {!ticket && isBooking(f.kind) && <button class="btn btn-primary btn-block" onClick={() => open('ticket', { date: f.date, kind: f.kind, itemId: f.id })}><Icon name="upload" size={18} />Add the booking</button>}
          {place && <button class="btn btn-block" onClick={() => { close(); go('place/' + place.id); }}><Icon name="pin" size={18} />Open place card</button>}
          <a class="btn btn-block" href={mapsLink(place || { name: f.title, city: dayInfo(days, f.date).city })} target="_blank" rel="noopener"><Icon name="nav" size={18} />Google Maps</a>
          <div class="two">
            <button class="btn" onClick={() => open('expense', { itemId: f.id, where: f.title, date: f.date })}>+€ Expense</button>
            <button class="btn" onClick={() => setEdit(true)}><Icon name="edit" size={16} />Edit</button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={isNew ? 'Add to the plan' : 'Edit plan item'}>
      <Field label="What" id="it"><input id="it" class="input" value={f.title} onInput={set('title')} placeholder="e.g. Lunch at the market" /></Field>
      <div class="two">
        <Field label="Day" id="idt">
          <select id="idt" class="input" value={f.date} onChange={set('date')}>{dates.map((d) => <option value={d}>{fmtDateLong(d)}</option>)}</select>
        </Field>
        <Field label="Time" id="itm"><input id="itm" class="input" type="time" value={f.time} onInput={set('time')} /></Field>
      </div>
      <div class="field"><label>Type</label><Chips options={ITEM_KINDS} value={f.kind} onChange={set('kind')} labels={KINDS} /></div>
      <Field label="Details" id="isub"><input id="isub" class="input" value={f.sub} onInput={set('sub')} placeholder="Short line under the title" /></Field>
      <Field label="Note" id="inote"><textarea id="inote" class="input" value={f.note} onInput={set('note')} /></Field>
      <Field label="For" id="iwho"><select id="iwho" class="input" value={f.who} onChange={set('who')}><option value="">Both of us</option><option>Gal</option><option>Mom</option></select></Field>
      {!f.placeId && places.length > 0 && (
        <Field label="Link a saved place (optional)" id="ipl">
          <select id="ipl" class="input" value="" onChange={(e) => { const p = places.find((x) => x.id === e.currentTarget.value); if (p) setF({ ...f, placeId: p.id, title: f.title || p.name, kind: p.kind }); }}>
            <option value="">Choose…</option>{places.map((p) => <option value={p.id}>{p.name}{p.city ? ' · ' + p.city : ''}</option>)}
          </select>
        </Field>
      )}
      <button class="btn btn-primary btn-block" style={{ marginTop: '16px', height: '54px' }} disabled={!f.title} onClick={save}>{isNew ? 'Add' : 'Save'}</button>
      {!isNew && <button class="btn btn-ghost btn-block" style={{ marginTop: '8px', color: 'var(--accent-text)' }} onClick={async () => { await remove('items', f.id); close(); }}>Remove from plan</button>}
    </Sheet>
  );
}

export function DaySheet({ date }) {
  const { data, close, toast } = useApp();
  const day = dayInfo(data.days, date);
  const [q, setQ] = useState(day.city || '');
  const [res, setRes] = useState([]);
  const [busy, setBusy] = useState(false);
  const pick = async (r) => {
    const city = cityOf(r.address) || (r.display_name || '').split(',')[0];
    const row = { tripId: data.trip.id, date, city, lat: parseFloat(r.lat), lon: parseFloat(r.lon), country: (r.address?.country_code || '').toUpperCase() };
    if (day.id) await patch('days', day.id, row); else await put('days', row);
    toast(city + ' set for ' + fmtDateLong(date));
    close();
  };
  return (
    <Sheet title={'Where are we on ' + fmtDateLong(date) + '?'}>
      <Field label="City" id="dc"><input id="dc" class="input" value={q} onInput={(e) => setQ(e.currentTarget.value)} /></Field>
      <button class="btn btn-primary btn-block" style={{ marginTop: '12px' }} disabled={!q || busy} onClick={async () => { setBusy(true); setRes(await searchPlace(q)); setBusy(false); }}><Icon name="search" size={16} />{busy ? 'Searching…' : 'Find city'}</button>
      <div class="stack" style={{ marginTop: '12px' }}>
        {res.map((r) => <button class="list-item" onClick={() => pick(r)}><span class="grow"><span class="title" style={{ display: 'block' }}>{(r.display_name || '').split(',')[0]}</span><span class="muted small">{(r.display_name || '').split(',').slice(1).join(',').trim()}</span></span></button>)}
      </div>
      <div class="muted small" style={{ marginTop: '10px' }}>The city sets the weather, local currency and nearby suggestions for that day.</div>
    </Sheet>
  );
}
