import { useState } from 'preact/hooks';
import { useApp, go } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { Sheet, Chips, Field } from './Sheets.jsx';
import { put, saveFile } from '../lib/db.js';
import { parseMapsLink, searchPlace, reversePlace, cityOf } from '../lib/services.js';
import { KINDS } from '../lib/util.js';
import { dayInfo, pickDefaultDate } from '../lib/trip.js';

const PLACE_KINDS = ['market', 'food', 'visit', 'gift', 'event', 'other'];
const kindFromOSM = (r) => {
  const t = `${r.category || ''} ${r.type || ''}`;
  if (/restaurant|cafe|bar|pub|bakery|food/.test(t)) return 'food';
  if (/marketplace|market/.test(t)) return 'market';
  if (/shop|mall/.test(t)) return 'gift';
  return 'visit';
};

export function PlaceSheet({ place, date }) {
  const { data, close, toast, selDate } = useApp();
  const { trip, days } = data;
  const day = dayInfo(days, date || selDate || pickDefaultDate(trip));
  const [step, setStep] = useState(place ? 'form' : 'paste');
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(place || { name: '', kind: 'visit', city: day.city, country: day.country, address: '', hours: '', parking: '', gettingThere: '', note: '', url: '', lat: null, lon: null, status: 'want' });
  const set = (k) => (e) => setF({ ...f, [k]: e?.currentTarget ? e.currentTarget.value : e });

  const fromOSM = (r, base = {}) => ({
    ...f, ...base,
    name: base.name || r.namedetails?.name || r.name || (r.display_name || '').split(',')[0],
    lat: parseFloat(r.lat), lon: parseFloat(r.lon), kind: kindFromOSM(r),
    city: cityOf(r.address) || f.city, country: (r.address?.country_code || '').toUpperCase() || f.country,
    address: [r.address?.road && (r.address.road + (r.address.house_number ? ' ' + r.address.house_number : '')), r.address?.postcode, cityOf(r.address)].filter(Boolean).join(', '),
    hours: r.extratags?.opening_hours || f.hours
  });

  const lookUp = async () => {
    const link = parseMapsLink(text);
    setBusy(true);
    const base = { url: link.url, name: link.name };
    try {
      if (link.lat != null) {
        const r = navigator.onLine ? await reversePlace(link.lat, link.lon) : null;
        setF(r ? { ...fromOSM(r, base), lat: link.lat, lon: link.lon, name: link.name || fromOSM(r).name } : { ...f, ...base, lat: link.lat, lon: link.lon });
        setStep('form');
      } else if (link.name && navigator.onLine) {
        const res = await searchPlace(link.name, day.lat != null ? day : null);
        if (res.length === 1) { setF(fromOSM(res[0], base)); setStep('form'); }
        else if (res.length) { setResults(res.map((r) => ({ r, base }))); setStep('choose'); }
        else { setF({ ...f, ...base }); setStep('form'); toast('Couldn’t find it on the map. Fill in what you know.'); }
      } else {
        setF({ ...f, ...base, name: link.name || text });
        setStep('form');
        if (link.url && !link.name) toast('Short links can’t be read offline. Type the name and we’ll find it.');
      }
    } catch (e) { setF({ ...f, ...base }); setStep('form'); }
    setBusy(false);
  };

  const save = async () => {
    const p = await put('places', { ...f, tripId: trip.id });
    toast('Saved to Want to see');
    close();
    if (!place) go('place/' + p.id);
  };

  if (step === 'paste') {
    return (
      <Sheet title="Add a place">
        <p class="muted" style={{ marginTop: '6px' }}>In Google Maps tap Share → Copy link, then paste it here. Or just type the name.</p>
        <Field label="Link or name" id="pl"><textarea id="pl" class="input" style={{ minHeight: '90px' }} value={text} onInput={(e) => setText(e.currentTarget.value)} placeholder="https://maps.app.goo.gl/… or “Café Sacher Vienna”" /></Field>
        <button class="btn btn-primary btn-block" style={{ marginTop: '12px', height: '52px' }} disabled={!text.trim() || busy} onClick={lookUp}><Icon name="search" size={18} />{busy ? 'Looking it up…' : 'Find it'}</button>
        <button class="btn btn-ghost btn-block" style={{ marginTop: '8px' }} onClick={() => setStep('form')}>Fill in by hand</button>
      </Sheet>
    );
  }
  if (step === 'choose') {
    return (
      <Sheet title="Which one?">
        <div class="stack" style={{ marginTop: '12px' }}>
          {results.map(({ r, base }) => (
            <button class="list-item" onClick={() => { setF(fromOSM(r, base)); setStep('form'); }}>
              <span class="ic"><Icon name={kindFromOSM(r)} size={18} /></span>
              <span class="grow"><span class="title ellipsis" style={{ display: 'block' }}>{(r.display_name || '').split(',')[0]}</span><span class="muted small ellipsis" style={{ display: 'block' }}>{(r.display_name || '').split(',').slice(1, 4).join(',')}</span></span>
            </button>
          ))}
        </div>
        <button class="btn btn-ghost btn-block" style={{ marginTop: '10px' }} onClick={() => setStep('form')}>None of these: fill in by hand</button>
      </Sheet>
    );
  }
  return (
    <Sheet title={place ? 'Edit place' : 'Place details'}>
      <Field label="Name" id="pn"><input id="pn" class="input" value={f.name} onInput={set('name')} /></Field>
      <div class="field"><label>Type</label><Chips options={PLACE_KINDS} value={f.kind} onChange={set('kind')} labels={KINDS} /></div>
      <div class="two">
        <Field label="City" id="pc"><input id="pc" class="input" list="tripcities" value={f.city} onInput={set('city')} /></Field>
        <Field label="Address" id="pa"><input id="pa" class="input" value={f.address} onInput={set('address')} /></Field>
      </div>
      <datalist id="tripcities">{[...new Set(days.map((d) => d.city).filter(Boolean))].map((c) => <option value={c} />)}</datalist>
      <Field label="Opening hours" id="ph"><input id="ph" class="input" value={f.hours} onInput={set('hours')} placeholder="e.g. Daily 11:00–21:00" /></Field>
      <Field label="Parking" id="pp"><input id="pp" class="input" value={f.parking} onInput={set('parking')} placeholder="Find it on the place card, or type it" /></Field>
      <Field label="Getting there" id="pg"><input id="pg" class="input" value={f.gettingThere} onInput={set('gettingThere')} placeholder="e.g. Tram 1 from the hotel" /></Field>
      <Field label="Our note: what we want to get or see" id="pnote"><textarea id="pnote" class="input" value={f.note} onInput={set('note')} /></Field>
      <div class="field">
        <label>Photo</label>
        <label class="btn btn-block"><Icon name="upload" size={16} />{f.photoFile ? 'Photo added ✓' : 'Add your own photo or screenshot'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => { const file = e.currentTarget.files?.[0]; if (file) setF({ ...f, photoFile: await saveFile(file) }); }} />
        </label>
        <div class="muted small">Otherwise a free photo from Wikimedia is used when one exists.</div>
      </div>
      {f.lat == null && <div class="muted small" style={{ marginTop: '10px' }}>No map location yet: directions will search by name.</div>}
      <button class="btn btn-primary btn-block" style={{ marginTop: '16px', height: '54px' }} disabled={!f.name} onClick={save}>Save place</button>
    </Sheet>
  );
}
