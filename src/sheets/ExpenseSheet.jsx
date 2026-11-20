import { useEffect, useState } from 'preact/hooks';
import { useApp } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { Sheet, Chips, Field } from './Sheets.jsx';
import { put, remove, saveFile, getKV } from '../lib/db.js';
import { getRates, toEUR, fromEUR } from '../lib/services.js';
import { EXPENSE_CATS, EXPENSE_LABEL, localCurrency, money, todayStr, nowHM } from '../lib/util.js';
import { dayInfo, pickDefaultDate, itemsOn } from '../lib/trip.js';

export function ExpenseSheet({ expense, itemId, placeId, where, city, date }) {
  const { data, close, toast, selDate } = useApp();
  const { trip, days, items } = data;
  const today = todayStr();
  const d0 = expense?.date || date || (today >= trip.start && today <= trip.end ? today : (selDate || pickDefaultDate(trip)));
  const day = dayInfo(days, d0);
  const local = localCurrency(day.country);
  // "Where" defaults to what's on the plan right now.
  const nowItem = !where && d0 === today ? itemsOn(items, d0).filter((i) => i.time && i.time <= nowHM()).pop() : null;
  const [f, setF] = useState(expense || { amount: '', currency: local, cat: 'food', where: where || nowItem?.title || '', city: city || day.city, date: d0, itemId: itemId || nowItem?.id || null, placeId: placeId || null, note: '' });
  const [rates, setRates] = useState(null);
  const [showUSD, setShowUSD] = useState(true);
  useEffect(() => { getRates().then(setRates); getKV('showUSD', true).then(setShowUSD); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e?.currentTarget ? e.currentTarget.value : e });
  const amt = Number(String(f.amount).replace(',', '.')) || 0;
  const eur = rates ? toEUR(amt, f.currency, rates) : amt;
  const currencies = [...new Set([local, 'USD', 'EUR'])].slice(0, 3);

  const save = async () => {
    await put('expenses', { ...f, tripId: trip.id, amount: amt, amountEUR: eur, createdAt: expense?.createdAt || new Date().toISOString() });
    toast('Expense saved');
    close();
  };

  return (
    <Sheet title={expense ? 'Edit expense' : 'Add expense'}>
      <div class="card" style={{ marginTop: '12px', padding: '16px', textAlign: 'center' }}>
        <label for="amt" class="muted small">Amount</label>
        <div class="row" style={{ justifyContent: 'center', gap: '6px' }}>
          <span class="muted" style={{ fontSize: '24px' }}>{f.currency === 'EUR' ? '€' : f.currency === 'USD' ? '$' : f.currency}</span>
          <input id="amt" class="big-amount" inputmode="decimal" autofocus value={f.amount} onInput={set('amount')} placeholder="0" style={{ width: '170px' }} />
        </div>
        <div class="seg" style={{ maxWidth: '260px', margin: '6px auto 0' }}>
          {currencies.map((c) => <button class={f.currency === c ? 'on' : ''} onClick={() => setF({ ...f, currency: c })}>{c === local ? `${c} · local` : c}</button>)}
        </div>
        {rates && amt > 0 && f.currency !== 'EUR' && <div class="muted small" style={{ marginTop: '8px' }}>= {money(eur, 'EUR', 2)}</div>}
        {rates && amt > 0 && showUSD && f.currency !== 'USD' && <div class="muted small" style={{ marginTop: '4px' }}>≈ {money(fromEUR(eur, 'USD', rates), 'USD', 2)}</div>}
      </div>
      <div class="field"><label>Category</label><Chips options={EXPENSE_CATS} value={f.cat} onChange={set('cat')} labels={EXPENSE_LABEL} /></div>
      <div class="two">
        <Field label="Where" id="ew"><input id="ew" class="input" value={f.where} onInput={set('where')} /></Field>
        <Field label="City" id="ec"><input id="ec" class="input" value={f.city} onInput={set('city')} /></Field>
      </div>
      <Field label="Date" id="ed"><input id="ed" class="input" type="date" value={f.date} onInput={(e) => { const d = e.currentTarget.value; setF({ ...f, date: d, city: dayInfo(days, d).city || f.city }); }} /></Field>
      <div class="field">
        <label>Receipt</label>
        <label class="btn btn-block"><Icon name="upload" size={16} />{f.receiptFileId ? 'Receipt added ✓' : 'Add a photo (optional)'}
          <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={async (e) => { const file = e.currentTarget.files?.[0]; if (file) setF({ ...f, receiptFileId: await saveFile(file) }); }} />
        </label>
      </div>
      <button class="btn btn-primary btn-block" style={{ marginTop: '16px', height: '54px' }} disabled={!amt} onClick={save}>Save expense</button>
      {expense && <button class="btn btn-ghost btn-block" style={{ marginTop: '8px', color: 'var(--accent-text)' }} onClick={async () => { await remove('expenses', expense.id); close(); }}>Delete</button>}
    </Sheet>
  );
}
