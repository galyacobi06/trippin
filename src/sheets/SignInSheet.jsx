import { useEffect, useState } from 'preact/hooks';
import { useApp } from '../app.jsx';
import { Sheet, Field } from './Sheets.jsx';
import { getConfig, saveConfig, signIn } from '../lib/sync.js';
import { db } from '../lib/db.js';

export function SignInSheet() {
  const { close, toast } = useApp();
  const [cfg, setCfg] = useState({ url: '', key: '' });
  const [built, setBuilt] = useState(true);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { getConfig().then((c) => { setCfg(c); setBuilt(!!(c.url && c.key)); }); }, []);
  return (
    <Sheet title="Sign in">
      <p class="muted" style={{ marginTop: '6px' }}>Use the same email and password Gal set up for you. Everything downloads to this device and stays available offline.</p>
      {!built && <>
        <Field label="Sync server address" id="u"><input id="u" class="input" value={cfg.url} onInput={(e) => setCfg({ ...cfg, url: e.currentTarget.value })} /></Field>
        <Field label="Public key" id="k"><input id="k" class="input" value={cfg.key} onInput={(e) => setCfg({ ...cfg, key: e.currentTarget.value })} /></Field>
      </>}
      <Field label="Email" id="e"><input id="e" class="input" type="email" autocomplete="username" value={email} onInput={(e) => setEmail(e.currentTarget.value)} /></Field>
      <Field label="Password" id="p"><input id="p" class="input" type="password" autocomplete="current-password" value={pw} onInput={(e) => setPw(e.currentTarget.value)} /></Field>
      {err && <div class="banner" role="alert" style={{ marginTop: '14px', fontSize: '13px' }}>{err}</div>}
      <button class="btn btn-primary btn-block" style={{ marginTop: '16px', height: '52px' }} disabled={busy || !email || !pw} onClick={async () => {
        setBusy(true);
        setErr('');
        try {
          if (!built) await saveConfig(cfg.url, cfg.key);
          await signIn(email, pw);
          const trips = (await db.trips.toArray()).filter((t) => !t.deleted);
          if (!trips.length) setErr('Signed in ✓ but no trip was found online yet. On Gal’s phone open Trip → Settings and check it says “Synced”, then tap Sync now here.');
          else { toast('Signed in, the trip is downloading'); close(); }
        } catch (e) { setErr(e.message || 'Sign-in failed'); }
        setBusy(false);
      }}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </Sheet>
  );
}
