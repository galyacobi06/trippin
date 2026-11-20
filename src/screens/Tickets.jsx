import { useEffect, useState } from 'preact/hooks';
import { useApp, go } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { Header } from '../components/bits.jsx';
import { fmtDateLong, KINDS, todayStr, money } from '../lib/util.js';
import { sortByDateTime } from '../lib/trip.js';
import { db, fileURL, useLive, remove } from '../lib/db.js';

const COLOR = { train: 'var(--navy)', flight: 'var(--navy)', hotel: '#9C7A3E', car: 'var(--accent-text)', event: 'var(--blue)' };

export function Tickets() {
  const { data, open } = useApp();
  const { tickets } = data;
  const files = useLive(() => db.files.toArray(), [], []);
  const blobs = useLive(() => db.blobs.toCollection().primaryKeys(), [], []);
  const [tab, setTab] = useState('upcoming');
  const today = todayStr();
  const list = tickets.filter((t) => (tab === 'used' ? (t.endDate || t.date) < today : (t.endDate || t.date || '9999') >= today)).sort(sortByDateTime);
  const review = tickets.filter((t) => t.status === 'review');
  const groups = [];
  for (const t of list) {
    const g = groups.find((x) => x.date === t.date);
    if (g) g.items.push(t); else groups.push({ date: t.date, items: [t] });
  }
  const withFile = tickets.filter((t) => t.fileId);
  const offline = withFile.filter((t) => blobs.includes(t.fileId)).length;

  return (
    <div class="screen">
      <div class="between">
        <h1 class="h1">Tickets</h1>
        <button class="btn" onClick={() => open('ticket')}><Icon name="upload" size={16} />Upload</button>
      </div>
      {withFile.length > 0 && (
        <div class="small" style={{ marginTop: '4px', color: offline === withFile.length ? 'var(--open)' : 'var(--muted)', fontWeight: 600 }}>
          ● {offline === withFile.length ? `All ${withFile.length} saved for offline` : `${offline} of ${withFile.length} saved for offline (connect to finish)`}
        </div>
      )}
      {review.length > 0 && (
        <div class="banner" style={{ marginTop: '14px' }}>
          <div style={{ flex: 1 }}>
            <div class="title">{review.length === 1 ? '1 booking needs a quick check' : `${review.length} bookings need a quick check`}</div>
            <div class="small muted">Details were read automatically</div>
          </div>
          <button class="btn btn-primary btn-sm" onClick={() => open('ticket', { ticket: review[0] })}>Review</button>
        </div>
      )}
      <div class="seg" style={{ marginTop: '14px' }}>
        <button class={tab === 'upcoming' ? 'on' : ''} onClick={() => setTab('upcoming')}>Upcoming</button>
        <button class={tab === 'used' ? 'on' : ''} onClick={() => setTab('used')}>Used</button>
      </div>
      {groups.map((g) => (
        <div>
          <div class="eyebrow" style={{ margin: '18px 4px 8px' }}>{g.date ? fmtDateLong(g.date) : 'No date yet'}</div>
          <div class="stack">
            {g.items.map((t) => (
              <button class="list-item" style={{ padding: 0, overflow: 'hidden' }} onClick={() => go('ticket/' + t.id)}>
                <span style={{ padding: '14px 0 14px 14px' }}>
                  <span style={{ width: '42px', height: '42px', borderRadius: '21px', background: COLOR[t.kind] || 'var(--navy)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={t.kind} size={20} /></span>
                </span>
                <span class="grow" style={{ padding: '12px 4px' }}>
                  <span class="eyebrow" style={{ fontSize: '10px', display: 'block' }}>{KINDS[t.kind]}{t.who ? ' · ' + t.who : ''}{t.price ? ' · ' + money(t.price, t.currency || 'EUR') : ''}</span>
                  <span class="title ellipsis" style={{ display: 'block' }}>{t.title}</span>
                  <span class="muted small ellipsis" style={{ display: 'block' }}>{[t.time, t.car && (t.kind === 'flight' ? 'Flight ' : 'Car ') + t.car, t.seat && 'Seat ' + t.seat, t.confirmation && '#' + t.confirmation].filter(Boolean).join(' · ') || 'Tap to see details'}</span>
                </span>
                <span style={{ width: '70px', alignSelf: 'stretch', borderLeft: '1.5px dashed var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--text)', fontSize: '11px', fontWeight: 600 }}>
                  <Icon name={t.fileId ? (files.find((f) => f.id === t.fileId)?.type?.startsWith('image') ? 'qr' : 'file') : (t.appLink ? 'link' : 'edit')} size={24} />
                  {t.fileId ? (files.find((f) => f.id === t.fileId)?.type?.startsWith('image') ? 'Image' : 'PDF') : (t.appLink ? 'App' : 'Info')}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {!groups.length && <div class="empty">{tab === 'used' ? 'Used tickets show up here after their date.' : 'No tickets yet. Tap Upload and pick the PDF or screenshot.'}</div>}
    </div>
  );
}

export function TicketView({ id }) {
  const { data, open } = useApp();
  const t = data.tickets.find((x) => x.id === id);
  const file = useLive(() => (t?.fileId ? db.files.get(t.fileId) : null), [t?.fileId], null);
  const [url, setUrl] = useState(null);
  const [extra, setExtra] = useState([]);
  const [state, setState] = useState('loading');
  useEffect(() => {
    let urls = [];
    if (!t?.fileId) { setState('none'); return; }
    (async () => {
      const x = await fileURL(t.fileId);
      urls.push(x); setUrl(x); setState(x ? 'ok' : 'missing');
      const more = [];
      for (const id of (t.fileIds || []).slice(1)) { const u = await fileURL(id); if (u) { more.push(u); urls.push(u); } }
      setExtra(more);
    })();
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
  }, [t?.fileId, (t?.fileIds || []).join()]);
  if (!t) return <div class="screen"><Header title="Ticket" /><div class="empty">This ticket was removed.</div></div>;
  const isImg = file?.type?.startsWith('image');
  return (
    <div class="screen">
      <Header title={t.title} eyebrow={KINDS[t.kind] + (t.date ? ' · ' + fmtDateLong(t.date) : '')}
        right={<button class="icon-btn" aria-label="Edit ticket" onClick={() => open('ticket', { ticket: t })}><Icon name="edit" /></button>} />
      <div style={{ marginTop: '14px' }}>
        {state === 'ok' && (isImg ? <div class="stack"><img class="viewer-img" src={url} alt={'Ticket: ' + t.title} />{extra.map((u, i) => <img class="viewer-img" src={u} alt={`${t.title}, page ${i + 2}`} />)}</div> : (
          <>
            <iframe class="viewer" src={url} title={'Ticket PDF: ' + t.title} />
            <a class="btn btn-block" style={{ marginTop: '10px' }} href={url} target="_blank" rel="noopener"><Icon name="file" size={16} />Open full screen</a>
          </>
        ))}
        {state === 'missing' && <div class="banner">The file is on another device and hasn't downloaded yet. Connect to the internet once and it will be saved here for offline.</div>}
        {state === 'loading' && <div class="empty">Opening…</div>}
      </div>
      {t.appLink && <a class="btn btn-primary btn-block" style={{ marginTop: '12px' }} href={t.appLink} target="_blank" rel="noopener"><Icon name="link" size={16} />Open in the rail/airline app</a>}
      <div class="card pad" style={{ marginTop: '14px', paddingTop: '4px', paddingBottom: '4px' }}>
        {[['Price', t.price ? money(t.price, t.currency || 'EUR', 2) : ''], ['When', [t.date && fmtDateLong(t.date), t.time].filter(Boolean).join(' · ')], ['Until', t.endDate && fmtDateLong(t.endDate)], ['From → to', t.from && t.to ? `${t.from} → ${t.to}` : ''], [t.kind === 'flight' ? 'Flight / seat' : 'Car / seat', [t.car && (t.kind === 'flight' ? 'Flight ' : 'Car ') + t.car, t.seat && 'Seat ' + t.seat].filter(Boolean).join(' · ')], ['Confirmation', t.confirmation], ['Address', t.address], ['For', t.who], ['Notes', t.note]]
          .filter(([, v]) => v).map(([k, v]) => <div class="kv"><div class="k">{k}</div><div class="v">{v}</div></div>)}
      </div>
      <button class="btn btn-ghost btn-block" style={{ marginTop: '14px', color: 'var(--accent-text)' }} onClick={async () => { if (confirm('Delete this ticket?')) { await remove('tickets', t.id); history.back(); } }}><Icon name="trash" size={16} />Delete ticket</button>
    </div>
  );
}
