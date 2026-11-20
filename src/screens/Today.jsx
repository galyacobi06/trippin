import { useEffect, useState } from 'preact/hooks';
import { useApp, go } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { DayStrip, WeatherChip, Photo, useTripTemps } from '../components/bits.jsx';
import { Timeline } from '../components/Timeline.jsx';
import { dateRange, todayStr, nowHM, fmtDateLong, minutes, fmtDuration, daysBetween, distanceKm, fmtDistance, mapsLink, isBooking } from '../lib/util.js';
import { dayInfo, itemsOn, pickDefaultDate } from '../lib/trip.js';
import { getPosition } from '../lib/services.js';

export function Today() {
  const { data, selDate, setSelDate, open, mode, setMode } = useApp();
  const { trip, days, items, places, tickets } = data;
  const dates = dateRange(trip.start, trip.end);
  const sel = selDate && dates.includes(selDate) ? selDate : pickDefaultDate(trip);
  const day = dayInfo(days, sel);
  const list = itemsOn(items, sel);
  const temps = useTripTemps(days);
  const today = todayStr();
  const isToday = sel === today;
  const now = nowHM();
  const [pos, setPos] = useState(null);
  useEffect(() => { getPosition().then(setPos); }, []);

  // What's happening now (or first up, when looking at another day).
  const timed = list.filter((i) => i.time);
  let current = null, label = 'FIRST UP';
  if (isToday) {
    const started = timed.filter((i) => i.time <= now);
    current = started[started.length - 1] || null;
    label = current ? 'RIGHT NOW' : 'COMING UP';
    if (!current) current = timed.find((i) => i.time > now) || list[0] || null;
  } else current = list.find((i) => !isBooking(i.kind)) || list[0] || null;
  const upNext = list.find((i) => i !== current && isBooking(i.kind) && (!isToday || !i.time || i.time > now)) || null;

  const place = current?.placeId ? places.find((p) => p.id === current.placeId) : null;
  const heroSubject = place ? { ...place, _table: 'places' } : { id: current?.id, name: current ? (isBooking(current.kind) ? day.city : current.title) : day.city, city: day.city, kind: current?.kind, photo: current?.photo, _table: current ? 'items' : null };

  const origin = isToday && pos ? pos : (day.lat != null ? day : null);
  const near = places.filter((p) => p.status !== 'been' && p.lat != null && (!day.city || p.city === day.city || (origin && distanceKm(origin, p) < 30)))
    .map((p) => ({ ...p, km: origin ? distanceKm(origin, p) : null }))
    .sort((a, b) => (a.km ?? 999) - (b.km ?? 999)).slice(0, 4);

  const until = daysBetween(today, trip.start);
  const ticketFor = (it) => it?.ticketId && tickets.find((t) => t.id === it.ticketId);
  const nextModes = { light: 'dark', dark: 'festive', festive: 'light' };

  return (
    <div class="screen">
      <div class="top">
        <div class="brand">TRIPPIN</div>
        <div class="row">
          <div class="row" style={{ gap: 0 }} aria-label="Travellers: Gal and Mom">
            <span style={avatar('var(--accent)')}>GAL</span>
            <span style={{ ...avatar('var(--navy)'), marginLeft: '-6px' }}>MOM</span>
          </div>
          <button class="icon-btn" aria-label={`Mode: ${mode}. Switch`} onClick={() => setMode(nextModes[mode] || 'light')}><Icon name="mode" /></button>
        </div>
      </div>

      {until > 0 && (
        <div class="card pad navy" style={{ marginTop: '14px' }}>
          <div class="small" style={{ color: 'var(--on-navy-muted)' }}>{trip.name}</div>
          <div class="serif" style={{ fontSize: '26px', fontWeight: 600 }}>Starts in {until} {until === 1 ? 'day' : 'days'}</div>
          <div class="small" style={{ color: 'var(--on-navy-muted)' }}>Tap any day below to preview it</div>
        </div>
      )}

      <div class="between" style={{ marginTop: '14px', alignItems: 'flex-end' }}>
        <div style={{ minWidth: 0 }}>
          <h1 class="h1">{fmtDateLong(sel)}</h1>
          <div class="muted" style={{ marginTop: '4px', fontSize: '13px' }}>Day {dates.indexOf(sel) + 1} of {dates.length}{day.city ? ' · ' + day.city : ''}</div>
        </div>
        <WeatherChip day={day} onOpen={() => open('weather', { date: sel })} />
      </div>

      <div style={{ marginTop: '14px' }}>
        <DayStrip dates={dates} days={days} selected={sel} onPick={setSelDate} temps={temps} />
      </div>

      {current ? (
        <div class="card" style={{ marginTop: '16px', overflow: 'hidden' }}>
          <Photo place={heroSubject} height={160}>
            <span class="tag">{label}{current.time ? ' · ' + current.time : ''}</span>
          </Photo>
          <div class="pad" style={{ paddingTop: '14px' }}>
            <div class="row" style={{ gap: '8px', alignItems: 'flex-start' }}>
              <span class="ic" style={{ width: '32px', height: '32px' }}><Icon name={current.kind} size={16} /></span>
              <div class="serif" style={{ fontSize: '26px', fontWeight: 600, lineHeight: 1.1 }}>{current.title}</div>
            </div>
            <div class="muted" style={{ fontSize: '13px', marginTop: '4px' }}>
              {[place?.hours && 'Hours: ' + place.hours, place?.address, current.sub].filter(Boolean).join(' · ')}
              {isToday && pos && place?.lat != null ? ' · ' + fmtDistance(distanceKm(pos, place)) : ''}
            </div>
            {(place?.note || current.note) && <div class="soft" style={{ padding: '10px 12px', marginTop: '10px', fontSize: '13px' }}>Our note: {place?.note || current.note}</div>}
            <div class="row" style={{ marginTop: '14px', gap: '8px' }}>
              <a class="btn btn-primary" style={{ flex: 1 }} href={mapsLink(place || { name: current.title, city: day.city, lat: current.lat, lon: current.lon })} target="_blank" rel="noopener"><Icon name="nav" size={18} />Google Maps</a>
              <button class="btn" onClick={() => place ? go('place/' + place.id) : open('item', { item: current })}>Details</button>
              <button class="icon-btn" style={{ width: '46px', height: '46px', color: 'var(--gold-text)', fontWeight: 700 }} aria-label="Add expense here" onClick={() => open('expense', { itemId: current.id, where: current.title, date: sel })}>+€</button>
            </div>
          </div>
        </div>
      ) : (
        <div class="card pad" style={{ marginTop: '16px' }}>
          <div class="title">Nothing planned for this day yet</div>
          <div class="muted small" style={{ marginTop: '4px' }}>Add a plan item, a place from your list, or upload a booking.</div>
          <button class="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => open('add', { date: sel })}><Icon name="plus" size={18} />Add to this day</button>
        </div>
      )}

      {upNext && (
        <div class="card navy" style={{ marginTop: '12px', padding: '14px 12px 14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ width: '44px', height: '44px', borderRadius: '22px', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={upNext.kind} size={22} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', letterSpacing: '1.5px', fontWeight: 600, color: '#E3D5BA' }}>
              UP NEXT{upNext.time ? ' · ' + upNext.time : ''}{isToday && upNext.time ? ' · IN ' + fmtDuration(minutes(upNext.time) - minutes(now)).toUpperCase() : ''}
            </div>
            <div class="ellipsis" style={{ fontSize: '15px', fontWeight: 700, marginTop: '2px' }}>{upNext.title}</div>
            <div class="ellipsis" style={{ fontSize: '12px', color: 'var(--on-navy-muted)' }}>{upNext.sub}</div>
          </div>
          {ticketFor(upNext)
            ? <button class="btn btn-gold btn-sm" style={{ height: '44px' }} onClick={() => go('ticket/' + upNext.ticketId)}>Ticket</button>
            : <button class="btn btn-gold btn-sm" style={{ height: '44px' }} onClick={() => open('ticket', { date: sel, kind: upNext.kind, itemId: upNext.id })}>Add</button>}
        </div>
      )}

      <div class="section-head">
        <h2 class="h2">{isToday ? "Today's plan" : 'The day'}</h2>
        <button class="link" onClick={() => go('plan')}>Edit day</button>
      </div>
      <Timeline list={list} isToday={isToday} now={now} current={current} />

      <div class="section-head">
        <h2 class="h2">{isToday ? 'Near you' : `In ${day.city || 'this city'}`}</h2>
        <button class="link" onClick={() => go('discover')}>Discover more</button>
      </div>
      {near.length ? (
        <div class="grid2">
          {near.map((p) => (
            <button class="card" style={{ overflow: 'hidden', border: 'none', padding: 0, textAlign: 'left', color: 'inherit' }} onClick={() => go('place/' + p.id)}>
              <Photo place={{ ...p, _table: 'places' }} height={88} />
              <div style={{ padding: '10px 12px 12px' }}>
                <div class="ellipsis" style={{ fontSize: '14px', fontWeight: 600 }}>{p.name}</div>
                <div class="muted small ellipsis" style={{ marginTop: '2px' }}>{[p.km != null && fmtDistance(p.km), p.hours || 'on your list'].filter(Boolean).join(' · ')}</div>
              </div>
            </button>
          ))}
        </div>
      ) : <div class="empty">No saved places here yet. Paste a Google Maps link with the + button.</div>}
    </div>
  );
}

const avatar = (bg) => ({ width: '40px', height: '40px', borderRadius: '20px', background: bg, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '10px', letterSpacing: '0.3px', border: '2px solid var(--bg)' });
