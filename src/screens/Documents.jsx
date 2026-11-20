import { useEffect, useState } from 'preact/hooks';
import { useApp } from '../app.jsx';
import Icon from '../components/Icon.jsx';
import { Header } from '../components/bits.jsx';
import { db, useLive, alive, getKV, setKV, put, saveFile, fileURL, remove } from '../lib/db.js';

// Passports & IDs, shared between Gal and Mom, behind Face ID (or a PIN) on each device.
let unlockedUntil = 0;
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function sha(text) { return b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))); }
const canBio = () => !!(window.PublicKeyCredential && navigator.credentials);

async function setupFaceId() {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'TRIPPIN' },
    user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'trippin-documents', displayName: 'TRIPPIN documents' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000
  } });
  return b64(cred.rawId);
}
async function checkFaceId(id) {
  await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64(id) }], userVerification: 'required', timeout: 60000 } });
}

export function Documents() {
  const { open, toast } = useApp();
  const lock = useLive(() => getKV('docLock', null), [], undefined);
  const [unlocked, setUnlocked] = useState(Date.now() < unlockedUntil);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const docs = alive(useLive(() => db.docs.toArray(), [], []));
  const [viewing, setViewing] = useState(null);

  const ok = () => { unlockedUntil = Date.now() + 5 * 60000; setUnlocked(true); setErr(''); setPin(''); };
  const tryFace = async () => { try { await checkFaceId(lock.credId); ok(); } catch (e) { setErr('Face ID didn’t work. Use your PIN.'); } };
  useEffect(() => { if (lock?.credId && !unlocked) tryFace(); }, [lock?.credId]);

  if (lock === undefined) return null;

  if (!lock) {
    return (
      <div class="screen">
        <Header title="Documents" eyebrow="Passports & IDs" />
        <p class="muted">Choose a PIN for this device. You can add Face ID after. The documents are shared with Mom's devices; each device has its own lock.</p>
        <div class="field"><label for="newpin">New PIN (4–6 digits)</label><input id="newpin" class="input" inputmode="numeric" type="password" maxLength={6} value={pin} onInput={(e) => setPin(e.currentTarget.value.replace(/\D/g, ''))} /></div>
        <button class="btn btn-primary btn-block" style={{ marginTop: '14px' }} disabled={pin.length < 4} onClick={async () => { await setKV('docLock', { pinHash: await sha('trippin:' + pin) }); ok(); toast('PIN set'); }}>Set PIN</button>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div class="screen">
        <Header title="Documents" eyebrow="Locked" />
        <div style={{ textAlign: 'center', margin: '30px 0 10px', color: 'var(--accent-text)' }}><Icon name="lock" size={48} stroke={1.3} /></div>
        {lock.credId && <button class="btn btn-primary btn-block" onClick={tryFace}>Unlock with Face ID</button>}
        <div class="field"><label for="pin">PIN</label><input id="pin" class="input" inputmode="numeric" type="password" maxLength={6} value={pin} onInput={(e) => setPin(e.currentTarget.value.replace(/\D/g, ''))} /></div>
        {err && <div class="small" style={{ color: 'var(--accent-text)', marginTop: '8px' }}>{err}</div>}
        <button class="btn btn-block" style={{ marginTop: '12px' }} disabled={pin.length < 4} onClick={async () => { if ((await sha('trippin:' + pin)) === lock.pinHash) ok(); else setErr('Wrong PIN'); }}>Unlock</button>
      </div>
    );
  }

  const add = async (e) => {
    const f = e.currentTarget.files?.[0];
    if (!f) return;
    const name = prompt('What is it? (e.g. "Gal passport")', f.name.replace(/\.\w+$/, '')) || f.name;
    const fileId = await saveFile(f);
    await put('docs', { tripId: null, name, fileId });
    e.currentTarget.value = '';
    toast('Saved');
  };
  const view = async (d) => { const meta = await db.files.get(d.fileId); const u = await fileURL(d.fileId); if (u) setViewing({ ...d, url: u, isPdf: (meta?.type || '').includes('pdf') }); else toast('Not downloaded yet: connect once'); };

  return (
    <div class="screen">
      <Header title="Documents" eyebrow="Passports & IDs · shared with Mom" />
      {canBio() && !lock.credId && (
        <button class="btn btn-block" style={{ marginTop: '12px' }} onClick={async () => { try { const credId = await setupFaceId(); await setKV('docLock', { ...lock, credId }); toast('Face ID is on'); } catch (e) { toast('Face ID not available here'); } }}>
          <Icon name="lock" size={16} />Turn on Face ID
        </button>
      )}
      <div class="stack" style={{ marginTop: '14px' }}>
        {docs.map((d) => (
          <div class="list-item">
            <span class="ic"><Icon name="file" size={18} /></span>
            <button class="grow" style={{ background: 'none', border: 'none', textAlign: 'left', color: 'inherit', padding: 0 }} onClick={() => view(d)}><span class="title">{d.name}</span></button>
            <button class="icon-btn" aria-label={'Delete ' + d.name} onClick={async () => { if (confirm('Delete ' + d.name + '?')) await remove('docs', d.id); }}><Icon name="trash" size={16} /></button>
          </div>
        ))}
        {!docs.length && <div class="empty">Add photos or PDFs of passports, insurance, driving licences.</div>}
      </div>
      <label class="btn btn-primary btn-block" style={{ marginTop: '14px' }}><Icon name="upload" size={16} />Add a document<input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={add} /></label>
      {viewing && (
        <div class="backdrop" onClick={() => setViewing(null)} style={{ alignItems: 'center', padding: '16px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '520px' }}>
            {viewing.isPdf ? <iframe class="viewer" src={viewing.url} title={viewing.name} /> : <img class="viewer-img" src={viewing.url} alt={viewing.name} />}
            <button class="btn btn-block" style={{ marginTop: '10px' }} onClick={() => setViewing(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
