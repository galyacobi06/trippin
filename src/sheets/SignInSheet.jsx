import { useEffect, useState } from 'preact/hooks';
import { useApp } from '../app.jsx';
import { Sheet, Field } from './Sheets.jsx';
import { getConfig, saveConfig, signIn } from '../lib/sync.js';

export function SignInSheet() {
  const { close, toast } = useApp();
  const [cfg, setCfg] = useState({ url: '', key: '' });
  const [built, setBuilt] = useState(true);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
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
      <button class="btn btn-primary btn-block" style={{ marginTop: '16px', height: '52px' }} disabled={busy || !email || !pw} onClick={async () => {
        setBusy(true);
        try { if (!built) await saveConfig(cfg.url, cfg.key); await signIn(email, pw); toast('Signed in, downloading the trip'); close(); }
        catch (e) { toast(e.message || 'Sign-in failed'); }
        setBusy(false);
      }}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </Sheet>
  );
}
