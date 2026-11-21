import { useState } from 'preact/hooks';
import { useApp } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { Sheet, Chips, Field } from './Sheets.jsx';
import { put, saveFile, db } from '../lib/db.js';
import { pdfText, guessBooking, icsText } from '../lib/parse.js';
import { readImages } from '../lib/ocr.js';
import { aiRead } from '../lib/ai.js';
import { getRates, toEUR } from '../lib/services.js';
import { KINDS, BOOKING_KINDS, dateRange, localCurrency } from '../lib/util.js';
import { dayInfo, attachTicketToPlan, importBookings } from '../lib/trip.js';

const empty = { kind: 'train', title: '', date: '', time: '', endDate: '', from: '', to: '', car: '', seat: '', confirmation: '', address: '', price: '', currency: 'EUR', who: '', appLink: '', note: '' };

export function TicketSheet({ ticket, date, kind, itemId }) {
  const { data, close, toast } = useApp();
  const { trip, days, items } = data;
  const [step, setStep] = useState(ticket ? 'form' : 'pick');
  const [f, setF] = useState(ticket ? { ...empty, ...ticket, price: ticket.price ?? '' } : { ...empty, date: date || '', kind: kind || 'train', currency: localCurrency(dayInfo(days, date || trip.start).country) });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [readText, setReadText] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.currentTarget ? e.currentTarget.value : e });

  const pick = async (e) => {
    const picked = [...(e.currentTarget.files || [])];
    const file = picked[0];
    if (!file) return;
    setBusy(true);
    // One or more screenshots of the same booking: read the text in them.
    if (picked.every((x) => /^image\//.test(x.type) || /\.(png|jpe?g|heic|webp)$/i.test(x.name))) {
      const fileIds = [];
      for (const x of picked) fileIds.push(await saveFile(x));
      let guess = {};
      setProgress('Reading with the smart reader…');
      const smart = await aiRead({ images: picked, trip });
      if (smart) { guess = smart; setReadText('Read by the smart reader (Google Gemini).'); }
      else try {
        setProgress('Getting the reader ready…');
        const text = await readImages(picked, (m) => setProgress(m.status === 'recognizing text' ? `Reading… ${Math.round((m.progress || 0) * 100)}%` : (m.status || '').startsWith('Reading') ? m.status : 'Getting the reader ready…'));
        setReadText(text);
        guess = guessBooking(text, file.name, trip);
      } catch (err) {
        console.warn(err);
        toast(navigator.onLine ? 'Couldn’t read the screenshot. Fill in the details.' : 'The first screenshot reading needs internet once. Fill in the details for now.');
      }
      if (/^IMG|screenshot/i.test(guess.title || '')) guess.title = '';
      const merged = { ...f, ...Object.fromEntries(Object.entries(guess).filter(([, v]) => v)), fileId: fileIds[0], fileIds, fileName: picked.length > 1 ? `${picked.length} screenshots` : file.name };
      if (kind) merged.kind = kind;
      if (date && !guess.date) merged.date = date;
      const draft = await put('tickets', { ...merged, tripId: trip.id, status: 'review' });
      setF({ ...merged, id: draft.id });
      setBusy(false); setProgress('');
      setStep('form');
      return;
    }
    if (/\.json$/i.test(file.name)) {
      try {
        const n = await importBookings(await file.text(), trip.id, items, saveFile, await getRates(), toEUR);
        toast(`Added ${n} booking${n === 1 ? '' : 's'} to Tickets and the plan`);
        close();
      } catch (err) { toast(err.message); setBusy(false); }
      return;
    }
    let guess = {};
    if (/\.ics$/i.test(file.name) || /calendar/i.test(file.type)) {
      const ics = icsText(await file.text());
      guess = guessBooking([ics.summary, ics.description, ics.location].join('\n'), file.name, trip);
      const merged = { ...f, ...Object.fromEntries(Object.entries(guess).filter(([, v]) => v)), note: ics.description.slice(0, 500), fileName: file.name };
      const draft = await put('tickets', { ...merged, tripId: trip.id, status: 'review' });
      setF({ ...merged, id: draft.id });
      setBusy(false);
      setStep('form');
      return;
    }
    const fileId = await saveFile(file);
    if (/pdf/i.test(file.type) || /\.pdf$/i.test(file.name)) {
      try {
        const txt = await pdfText(file); setReadText(txt);
        setProgress('Reading…');
        const smart = txt.trim().length > 40 ? await aiRead({ text: txt, trip }) : null;
        guess = smart || guessBooking(txt, file.name, trip);
      } catch (err) { console.warn(err); guess = guessBooking('', file.name, trip); }
    } else guess = guessBooking('', file.name, trip);
    const merged = { ...f, ...Object.fromEntries(Object.entries(guess).filter(([, v]) => v)), fileId, fileName: file.name };
    if (kind) merged.kind = kind;
    if (date && !guess.date) merged.date = date;
    const draft = await put('tickets', { ...merged, tripId: trip.id, status: 'review' });
    setF({ ...merged, id: draft.id });
    setBusy(false);
    setStep('form');
  };

  const save = async () => {
    const rates = await getRates();
    const price = f.price === '' ? null : Number(String(f.price).replace(',', '.'));
    const t = await put('tickets', { ...f, tripId: trip.id, status: 'ok', price, priceEUR: price ? toEUR(price, f.currency, rates) : 0 });
    await attachTicketToPlan(t, items, trip.id, itemId);
    toast('Saved to Tickets and the plan');
    close();
  };

  if (step === 'pick') {
    return (
      <Sheet title="Add a booking">
        <p class="muted" style={{ marginTop: '6px' }}>Pick the confirmation PDF, a calendar file (.ics), or one or more screenshots of the same booking. The details are read for you to check.</p>
        <label class="btn btn-primary btn-block" style={{ height: '54px', marginTop: '10px' }}>
          <Icon name="upload" size={18} />{busy ? (progress || 'Reading…') : 'Choose PDF or screenshots'}
          <input type="file" accept="application/pdf,image/*,.ics,text/calendar,.json,application/json" style={{ display: 'none' }} multiple onChange={pick} disabled={busy} />
        </label>
        <button class="btn btn-block" style={{ marginTop: '10px' }} onClick={() => setStep('form')}>Type the details instead</button>
        <p class="muted small" style={{ marginTop: '12px' }}>For tickets that only live in an app (some ÖBB / SBB / SNCF tickets), take a screenshot, or type the details and add the app link.</p>
      </Sheet>
    );
  }

  const dates = dateRange(trip.start, trip.end);
  return (
    <Sheet title={ticket ? 'Edit booking' : 'Check the details'}>
      {f.fileName && !ticket && <div class="banner" style={{ marginTop: '10px' }}><Icon name="file" size={18} /><div class="small">Read from <b>{f.fileName}</b>. Fix anything that's wrong, then save.</div></div>}
      <div style={{ marginTop: '12px' }}><Chips options={BOOKING_KINDS} value={f.kind} onChange={set('kind')} labels={KINDS} /></div>
      <Field label="Title" id="tt"><input id="tt" class="input" value={f.title} onInput={set('title')} placeholder="e.g. Vienna → Salzburg" /></Field>
      <div class="two">
        <Field label={f.kind === 'hotel' ? 'Check-in day' : 'Date'} id="td">
          <input id="td" class="input" type="date" min={trip.start} max={trip.end} value={f.date} onInput={set('date')} />
        </Field>
        <Field label={f.kind === 'hotel' ? 'Check-in time' : 'Time'} id="tm"><input id="tm" class="input" type="time" value={f.time} onInput={set('time')} /></Field>
      </div>
      {(f.kind === 'hotel' || f.kind === 'car') && <Field label={f.kind === 'hotel' ? 'Check-out day' : 'Return day'} id="te"><input id="te" class="input" type="date" value={f.endDate} onInput={set('endDate')} /></Field>}
      {(f.kind === 'train' || f.kind === 'flight') && <div class="two">
        <Field label="From" id="tf"><input id="tf" class="input" value={f.from} onInput={set('from')} /></Field>
        <Field label="To" id="tto"><input id="tto" class="input" value={f.to} onInput={set('to')} /></Field>
      </div>}
      {(f.kind === 'train' || f.kind === 'flight' || f.kind === 'event') && <div class="two">
        <Field label={f.kind === 'flight' ? 'Flight no.' : 'Car / coach'} id="tc"><input id="tc" class="input" value={f.car} onInput={set('car')} /></Field>
        <Field label="Seat(s)" id="ts"><input id="ts" class="input" value={f.seat} onInput={set('seat')} /></Field>
      </div>}
      <Field label="Confirmation number" id="tn"><input id="tn" class="input" value={f.confirmation} onInput={set('confirmation')} /></Field>
      {(f.kind === 'hotel' || f.kind === 'car' || f.kind === 'event') && <Field label="Address" id="ta"><input id="ta" class="input" value={f.address} onInput={set('address')} /></Field>}
      <div class="two">
        <Field label="Price (for trip total)" id="tp"><input id="tp" class="input" inputmode="decimal" value={f.price} onInput={set('price')} placeholder="optional" /></Field>
        <Field label="Currency" id="tcur">
          <select id="tcur" class="input" value={f.currency} onChange={set('currency')}>{['EUR', 'CHF', 'USD', 'ILS'].map((c) => <option>{c}</option>)}</select>
        </Field>
      </div>
      <Field label="For" id="tw">
        <select id="tw" class="input" value={f.who} onChange={set('who')}><option value="">Both of us</option><option>Gal</option><option>Mom</option></select>
      </Field>
      <Field label="App link (optional)" id="tl"><input id="tl" class="input" value={f.appLink} onInput={set('appLink')} placeholder="https://…" /></Field>
      <Field label="Notes" id="tno"><textarea id="tno" class="input" value={f.note} onInput={set('note')} /></Field>
      {readText && (
        <details style={{ marginTop: '14px' }}>
          <summary class="small muted" style={{ cursor: 'pointer', minHeight: '32px' }}>What the app read (to help fix mistakes)</summary>
          <pre class="soft small" style={{ whiteSpace: 'pre-wrap', padding: '10px 12px', maxHeight: '220px', overflow: 'auto', fontFamily: 'inherit' }}>{readText.trim()}</pre>
        </details>
      )}
      <button class="btn btn-primary btn-block" style={{ marginTop: '16px', height: '54px' }} disabled={!f.title} onClick={save}>{ticket ? 'Save' : 'Looks right, save'}</button>
    </Sheet>
  );
}
