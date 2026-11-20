import { useState } from 'preact/hooks';
import { useApp, go } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { Header, useRates, Usd } from '../components/bits.jsx';
import { money, EXPENSE_LABEL, fmtDate } from '../lib/util.js';
import { dayInfo } from '../lib/trip.js';

// Every cost in one list: bookings (hotels, flights, trains, car, events) + what we spend on the go.
const CATS = [
  ['hotel', 'Hotels'], ['flight', 'Flights'], ['train', 'Trains'], ['car', 'Car rental'], ['event', 'Tickets & events'],
  ['food', 'Food & drink'], ['gift', 'Markets & gifts'], ['transport', 'Local transport'], ['visit', 'Sights'], ['other', 'Other']
];
const CAT_LABEL = Object.fromEntries(CATS);

export function Expenses() {
  const { data, open } = useApp();
  const { expenses, tickets, days } = data;
  const rates = useRates();
  const [filter, setFilter] = useState(null);

  const entries = [
    ...tickets.filter((t) => t.priceEUR > 0).map((t) => ({
      id: t.id, booking: true, cat: t.kind, title: t.title, date: t.date || '', city: dayInfo(days, t.date).city || 'Other',
      eur: t.priceEUR, amount: t.price, currency: t.currency || 'EUR', open: () => go('ticket/' + t.id)
    })),
    ...expenses.map((e) => ({
      id: e.id, booking: false, cat: e.cat || 'other', title: e.where || EXPENSE_LABEL[e.cat] || 'Expense', date: e.date || '', city: e.city || 'Other',
      eur: e.amountEUR || 0, amount: e.amount, currency: e.currency || 'EUR', open: () => open('expense', { expense: e })
    }))
  ];
  const sum = (list) => list.reduce((s, x) => s + x.eur, 0);
  const total = sum(entries);
  const prebooked = sum(entries.filter((x) => x.booking));
  const onTheGo = total - prebooked;

  const route = [];
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) if (d.city && !route.includes(d.city)) route.push(d.city);
  const cityRows = [...route, ...new Set(entries.map((x) => x.city).filter((c) => !route.includes(c)))].map((c) => [c, sum(entries.filter((x) => x.city === c))]);
  const maxCity = Math.max(1, ...cityRows.map(([, v]) => v));
  const catRows = CATS.map(([k, label]) => [k, label, sum(entries.filter((x) => x.cat === k))]).sort((a, b) => b[2] - a[2]);
  const list = entries.filter((x) => !filter || x.cat === filter).sort((a, b) => b.date.localeCompare(a.date));

  const exportCSV = () => {
    const rows = [['Date', 'What', 'City', 'Category', 'Booking?', 'Amount', 'Currency', 'EUR'], ...entries.map((x) => [x.date, x.title, x.city, CAT_LABEL[x.cat] || x.cat, x.booking ? 'yes' : 'no', x.amount, x.currency, x.eur.toFixed(2)])];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'trip-expenses.csv'; a.click();
  };

  return (
    <div class="screen">
      <Header title="Expenses" eyebrow={data.trip.name} right={<button class="btn btn-primary btn-sm" onClick={() => open('expense')}><Icon name="plus" size={16} />Add</button>} />

      <div class="card navy" style={{ marginTop: '14px', padding: '18px 20px' }}>
        <div class="small" style={{ color: '#E3D5BA' }}>Whole trip so far</div>
        <div class="row" style={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span class="serif" style={{ fontSize: '44px', fontWeight: 600, lineHeight: 1.1 }}>{money(total)}</span>
          {rates && total > 0 && <span style={{ color: 'var(--on-navy-muted)', fontSize: '14px' }}><Usd eur={total} rates={rates} /></span>}
        </div>
        <div class="grid2" style={{ marginTop: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '14px', padding: '10px 12px' }}>
            <div class="small" style={{ color: 'var(--on-navy-muted)' }}>Pre-booked</div>
            <div style={{ fontSize: '17px', fontWeight: 700 }}>{money(prebooked)}</div>
            <div class="small" style={{ color: 'var(--on-navy-muted)' }}>hotels, travel, tickets</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '14px', padding: '10px 12px' }}>
            <div class="small" style={{ color: 'var(--on-navy-muted)' }}>On the go</div>
            <div style={{ fontSize: '17px', fontWeight: 700 }}>{money(onTheGo)}</div>
            <div class="small" style={{ color: 'var(--on-navy-muted)' }}>{expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}</div>
          </div>
        </div>
      </div>

      <div class="section-head"><h2 class="h2">By category</h2>{filter && <button class="link" onClick={() => setFilter(null)}>Show all</button>}</div>
      <div class="grid2">
        {catRows.map(([k, label, v]) => (
          <button class="card" onClick={() => setFilter(filter === k ? null : k)} aria-pressed={filter === k}
            style={{ border: filter === k ? '2px solid var(--accent)' : '1px solid var(--line)', boxShadow: 'none', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left', color: 'inherit', opacity: v > 0 ? 1 : 0.6 }}>
            <span class="ic" style={{ width: '34px', height: '34px' }}><Icon name={k} size={17} /></span>
            <span style={{ minWidth: 0 }}>
              <span class="muted small ellipsis" style={{ display: 'block' }}>{label}</span>
              <b style={{ fontSize: '15px' }}>{money(v)}</b>
            </span>
          </button>
        ))}
      </div>

      <div class="section-head"><h2 class="h2">By city</h2></div>
      <div class="stack">
        {cityRows.map(([c, v]) => (
          <div>
            <div class="between" style={{ fontSize: '13px' }}><b>{c}</b><span class={v ? '' : 'muted'}>{money(v)}</span></div>
            <div class="bar"><div style={{ width: Math.round(v / maxCity * 100) + '%' }} /></div>
          </div>
        ))}
      </div>

      <div class="section-head"><h2 class="h2">{filter ? CAT_LABEL[filter] : 'All costs'}</h2>{entries.length > 0 && <button class="link" onClick={exportCSV}>Export</button>}</div>
      {list.map((x) => (
        <button onClick={x.open} style={{ width: '100%', padding: '10px 2px', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span class="row" style={{ minWidth: 0 }}>
            <span class="ic" style={{ width: '32px', height: '32px' }}><Icon name={x.cat} size={16} /></span>
            <span style={{ minWidth: 0 }}>
              <span class="title ellipsis" style={{ display: 'block', fontSize: '14px' }}>{x.title}</span>
              <span class="muted small">{[x.date && fmtDate(x.date), x.city !== 'Other' && x.city, x.booking ? 'booking' : CAT_LABEL[x.cat], x.currency !== 'EUR' && money(x.amount, x.currency)].filter(Boolean).join(' · ')}</span>
            </span>
          </span>
          <b style={{ whiteSpace: 'nowrap' }}>{money(x.eur, 'EUR', 2)}</b>
        </button>
      ))}
      {!list.length && <div class="empty">{filter ? 'Nothing in this category yet.' : 'Prices of your bookings and everything you add with +€ show up here.'}</div>}
      <div class="muted small" style={{ marginTop: '12px' }}>A booking counts once its price is filled in. Open it in Tickets → edit to add or fix the price.</div>
    </div>
  );
}
