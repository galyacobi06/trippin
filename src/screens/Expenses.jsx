import { useApp } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { Header, useRates, Usd } from '../components/bits.jsx';
import { money, EXPENSE_CATS, EXPENSE_LABEL, fmtDate } from '../lib/util.js';

export function Expenses() {
  const { data, open } = useApp();
  const { expenses, tickets, days } = data;
  const rates = useRates();
  const onTheGo = expenses.reduce((s, e) => s + (e.amountEUR || 0), 0);
  const prebooked = tickets.reduce((s, t) => s + (t.priceEUR || 0), 0);
  const total = onTheGo + prebooked;
  const byCity = {};
  for (const e of expenses) { const c = e.city || 'Other'; byCity[c] = (byCity[c] || 0) + (e.amountEUR || 0); }
  const order = [...new Set([...days].sort((a, b) => a.date.localeCompare(b.date)).map((d) => d.city).filter(Boolean)), 'Other'];
  const cityRows = Object.entries(byCity).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
  const max = Math.max(1, ...cityRows.map(([, v]) => v));
  const byCat = EXPENSE_CATS.map((c) => [c, expenses.filter((e) => (e.cat || 'other') === c).reduce((s, e) => s + (e.amountEUR || 0), 0)]).filter(([, v]) => v > 0);
  const latest = [...expenses].sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || ''))).slice(0, 30);

  const exportCSV = () => {
    const rows = [['Date', 'Where', 'City', 'Category', 'Amount', 'Currency', 'EUR'], ...expenses.map((e) => [e.date, e.where, e.city, EXPENSE_LABEL[e.cat] || e.cat, e.amount, e.currency, (e.amountEUR || 0).toFixed(2)])];
    const csv = rows.map((r) => r.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'trip-expenses.csv'; a.click();
  };

  return (
    <div class="screen">
      <Header title="Expenses" eyebrow={data.trip.name} right={<button class="btn btn-primary btn-sm" onClick={() => open('expense')}><Icon name="plus" size={16} />Add</button>} />
      <div class="card navy" style={{ marginTop: '14px', padding: '18px 20px' }}>
        <div class="small" style={{ color: '#E3D5BA' }}>Whole trip so far</div>
        <div class="row" style={{ alignItems: 'baseline' }}>
          <span class="serif" style={{ fontSize: '44px', fontWeight: 600, lineHeight: 1.1 }}>{money(total)}</span>
          {rates && <span style={{ color: 'var(--on-navy-muted)', fontSize: '14px' }}><Usd eur={total} rates={rates} /></span>}
        </div>
        <div class="grid2" style={{ marginTop: '12px' }}>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '14px', padding: '10px 12px' }}>
            <div class="small" style={{ color: 'var(--on-navy-muted)' }}>Pre-booked</div>
            <div style={{ fontSize: '17px', fontWeight: 700 }}>{money(prebooked)}</div>
            <div class="small" style={{ color: 'var(--on-navy-muted)' }}>prices on your tickets</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '14px', padding: '10px 12px' }}>
            <div class="small" style={{ color: 'var(--on-navy-muted)' }}>On the go</div>
            <div style={{ fontSize: '17px', fontWeight: 700 }}>{money(onTheGo)}</div>
            <div class="small" style={{ color: 'var(--on-navy-muted)' }}>{expenses.length} expenses</div>
          </div>
        </div>
      </div>

      {cityRows.length > 0 && <>
        <div class="section-head"><h2 class="h2">By city</h2></div>
        <div class="stack">
          {cityRows.map(([c, v]) => (
            <div>
              <div class="between" style={{ fontSize: '13px' }}><b>{c}</b><span>{money(v)}</span></div>
              <div class="bar"><div style={{ width: Math.round(v / max * 100) + '%' }} /></div>
            </div>
          ))}
        </div>
      </>}

      {byCat.length > 0 && <>
        <div class="section-head"><h2 class="h2">By category</h2></div>
        <div class="row" style={{ flexWrap: 'wrap', gap: '8px' }}>
          {byCat.map(([c, v]) => (
            <span class="card row" style={{ padding: '8px 12px 8px 8px', gap: '8px', fontSize: '13px', boxShadow: 'none', border: '1px solid var(--line)' }}>
              <span class="ic" style={{ width: '28px', height: '28px' }}><Icon name={c} size={15} /></span>
              <span><span class="muted">{EXPENSE_LABEL[c]}</span> <b>{money(v)}</b></span>
            </span>
          ))}
        </div>
      </>}

      <div class="section-head"><h2 class="h2">Latest</h2>{expenses.length > 0 && <button class="link" onClick={exportCSV}>Export</button>}</div>
      {latest.map((e) => (
        <button class="between" style={{ width: '100%', padding: '10px 2px', borderBottom: '1px solid var(--line)', background: 'none', border: 'none', borderBottomStyle: 'solid', borderBottomWidth: '1px', borderBottomColor: 'var(--line)', textAlign: 'left', color: 'inherit' }} onClick={() => open('expense', { expense: e })}>
          <span class="row" style={{ minWidth: 0 }}>
            <span class="ic" style={{ width: '32px', height: '32px' }}><Icon name={e.cat || 'other'} size={16} /></span>
            <span style={{ minWidth: 0 }}>
              <span class="title ellipsis" style={{ display: 'block', fontSize: '14px' }}>{e.where || EXPENSE_LABEL[e.cat]}</span>
              <span class="muted small">{[fmtDate(e.date), e.city, e.currency !== 'EUR' && money(e.amount, e.currency)].filter(Boolean).join(' · ')}</span>
            </span>
          </span>
          <b>{money(e.amountEUR || 0, 'EUR', 2)}</b>
        </button>
      ))}
      {!expenses.length && <div class="empty">Tap +€ on any stop, or Add, to log what you spend.</div>}
    </div>
  );
}
