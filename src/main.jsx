import { render } from 'preact';
import './styles.css';
import { App } from './app.jsx';
import { startAutoSync } from './lib/sync.js';

render(<App />, document.getElementById('app'));
startAutoSync();

// Always run the newest version: check for updates on every open, and reload once when one is installed.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; location.reload(); }
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      setInterval(check, 30 * 60000);
    }).catch(() => {});
  });
}
// Ask the browser to keep our data even when storage is low.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
