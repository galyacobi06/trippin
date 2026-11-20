import { useState } from 'preact/hooks';
import { useApp, go } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { DayStrip, WeatherChip, useTripTemps, KindIcon } from '../components/bits.jsx';
import { Timeline } from '../components/Timeline.jsx';
import { dateRange, fmtDate, dow, fmtDateLong, KINDS } from '../lib/util.js';
import { dayInfo, itemsOn, pickDefaultDate } from '../lib/trip.js';
import { patch } from '../lib/db.js';

export function Plan() {
  const { data, selDate, setSelDate, open } = useApp();
  const { trip, days, items, places } = data;
  const [tab, setTab] = useState('days');
  const [city, setCity] = useState('All');
  const dates = dateRange(trip.start, trip.end);
  const sel = selDate && dates.includes(selDate) ? selDate : pickDefaultDate(trip);
  const day = dayInfo(days, sel);
  const temps = useTripTemps(days);
  const cities = ['All', ...new Set(days.map((d) => d.city).filter(Boolean))];
  const shown = places.filter((p) => (tab === 'been' ? p.status === 'been' : p.status !== 'been') && (city === 'All' || p.city === city));

  return (
    <div class="screen">
      <div class="between" style={{ alignItems: 'flex-end' }}>
        <h1 class="h1">Plan</h1>
        <div class="muted small" style={{ paddingBottom: '6px' }}>{fmtDate(trip.start)} – {fmtDate(trip.end)} · {dates.length} days</div>
      </div>
      <div class="seg" style={{ marginTop: '12px' }} role="tablist">
        <button role="tab" aria-selected={tab === 'days'} class={tab === 'days' ? 'on' : ''} onClick={() => setTab('days')}>Days</button>
        <button role="tab" aria-selected={tab === 'want'} class={tab === 'want' ? 'on' : ''} onClick={() => setTab('want')}>Want to see</button>
        <button role="tab" aria-selected={tab === 'been'} class={tab === 'been' ? 'on' : ''} onClick={() => setTab('been')}>Been there ✓</button>
      </div>

      {tab === 'days' ? (
        <>
          <div style={{ marginTop: '14px' }}><DayStrip dates={dates} days={days} selected={sel} onPick={setSelDate} temps={temps} /></div>
          <div class="card navy" style={{ marginTop: '14px', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', letterSpacing: '1.5px', color: '#E3D5BA', fontWeight: 600 }}>DAY {dates.indexOf(sel) + 1} · {dow(sel).toUpperCase()} {fmtDate(sel).toUpperCase()}</div>
              <button onClick={() => open('day', { date: sel })} style={{ background: 'none', border: 'none', color: '#fff', padding: 0, textAlign: 'left' }} aria-label="Change the city for this day">
                <span class="serif" style={{ fontSize: '24px', fontWeight: 600 }}>{day.city || 'Set the city'}</span> <Icon name="edit" size={14} />
              </button>
            </div>
            <WeatherChip day={day} dark onOpen={() => open('weather', { date: sel })} />
          </div>
          <div style={{ marginTop: '16px' }}>
            <Timeline list={itemsOn(items, sel)} showTravel />
          </div>
          <div class="two" style={{ marginTop: '10px' }}>
            <button class="btn" style={{ borderStyle: 'dashed' }} onClick={() => open('item', { item: { date: sel } })}><Icon name="plus" size={16} />Plan item</button>
            <button class="btn" style={{ borderStyle: 'dashed' }} onClick={() => setTab('want')}><Icon name="pin" size={16} />From my list</button>
          </div>
          <button class="btn btn-block" style={{ marginTop: '10px', borderStyle: 'dashed' }} onClick={() => open('ticket', { date: sel })}><Icon name="upload" size={16} />Upload a booking for {fmtDateLong(sel)}</button>
        </>
      ) : (
        <>
          <div class="strip" style={{ marginTop: '14px' }}>
            {cities.map((c) => <button class={'btn btn-sm' + (city === c ? ' btn-primary' : '')} style={{ flex: '0 0 auto' }} onClick={() => setCity(c)}>{c}</button>)}
          </div>
          <div class="stack" style={{ marginTop: '12px' }}>
            {shown.map((p) => (
              <div class="list-item">
                <button onClick={() => go('place/' + p.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit' }}>
                  <KindIcon kind={p.kind} />
                  <span class="grow">
                    <span class="title ellipsis" style={{ display: 'block' }}>{p.name}</span>
                    <span class="muted small ellipsis" style={{ display: 'block' }}>{[KINDS[p.kind], p.city, p.hours].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
                <div class="stack" style={{ gap: '6px', alignItems: 'flex-end' }}>
                  <label class="row small muted" style={{ gap: '6px', minHeight: '28px' }}>
                    <input type="checkbox" class="check" checked={p.status === 'been'} onChange={(e) => patch('places', p.id, { status: e.currentTarget.checked ? 'been' : 'want' })} />Been
                  </label>
                  {tab === 'want' && <button class="btn btn-sm" onClick={() => open('item', { item: { placeId: p.id, kind: p.kind, title: p.name, date: dates.find((d) => dayInfo(days, d).city === p.city) || sel } })}>+ Day</button>}
                </div>
              </div>
            ))}
            {!shown.length && <div class="empty">{tab === 'been' ? 'Tick "Been" on a place once you’ve visited it.' : 'Nothing here yet. Use + to paste a Google Maps link.'}</div>}
          </div>
          {tab === 'want' && <button class="btn btn-block" style={{ marginTop: '12px' }} onClick={() => open('place')}><Icon name="link" size={16} />Add a place (paste a link)</button>}
        </>
      )}
    </div>
  );
}
