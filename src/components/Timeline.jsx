import Icon from './Icon.jsx';
import { useApp, go } from '../app.jsx';
import { money, distanceKm, travelHint } from '../lib/util.js';

// C-style day timeline: icon per stop, NOW highlight, travel time between stops, spend per stop.
export function Timeline({ list, isToday, now, current, showTravel = false }) {
  const { open, data } = useApp();
  const { expenses, places, tickets } = data;
  if (!list.length) return <div class="empty">Nothing on this day yet.</div>;
  const loc = (it) => { const p = it.placeId && places.find((x) => x.id === it.placeId); return p && p.lat != null ? p : (it.lat != null ? it : null); };
  return (
    <div>
      {list.map((it, idx) => {
        const done = isToday && it.time && current && it.time < current.time;
        const isNow = isToday && current && it.id === current.id && current.time && current.time <= now;
        const spent = expenses.filter((e) => e.itemId === it.id).reduce((s, e) => s + (e.amountEUR || 0), 0);
        const ticket = it.ticketId && tickets.find((t) => t.id === it.ticketId);
        const booked = ticket?.priceEUR || 0;
        const shown = spent + booked;
        const next = list[idx + 1];
        const km = showTravel && next ? distanceKm(loc(it), loc(next)) : null;
        return (
          <div>
            <div class="tl-row">
              <div class="tl-time" style={isNow ? { color: 'var(--accent-text)' } : null}>{it.time || '—'}</div>
              <div class="tl-rail">
                <div class={'tl-dot' + (isNow ? ' now' : done ? ' done' : '')}><Icon name={it.kind} size={17} /></div>
                {idx < list.length - 1 && <div class="tl-line" />}
              </div>
              <button class="tl-body" onClick={() => open('item', { item: it })}>
                <div class="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
                  <span class="tl-title" style={done ? { color: 'var(--done)' } : null}>{it.title}</span>
                  {isNow && <span class="pill-now">NOW</span>}
                  {it.who && <span class="who">{it.who.toUpperCase()}</span>}
                </div>
                {it.sub && <div class="muted small" style={{ marginTop: '2px' }}>{it.sub}</div>}
              </button>
              {shown > 0
                ? <button class="spend" style={{ alignSelf: 'flex-start', marginTop: '10px' }} aria-label={`${money(shown, 'EUR', 2)} for ${it.title}`}
                    onClick={() => (booked && !spent ? go('ticket/' + ticket.id) : open('expense', { itemId: it.id, where: it.title, date: it.date }))}>
                    {ticket && booked && ticket.currency && ticket.currency !== 'EUR' && !spent ? money(ticket.price, ticket.currency) : money(shown, 'EUR', Number.isInteger(Math.round(shown * 100) / 100) ? 0 : 2)}
                  </button>
                : <button class="spend" style={{ alignSelf: 'flex-start', marginTop: '10px', opacity: 0.8 }} aria-label={'Add expense for ' + it.title} onClick={() => open('expense', { itemId: it.id, where: it.title, date: it.date })}>+€</button>}
            </div>
            {km != null && km > 0.05 && <div class="travel"><Icon name="chev" size={12} style={{ transform: 'rotate(90deg)' }} />{travelHint(km)}</div>}
          </div>
        );
      })}
    </div>
  );
}
