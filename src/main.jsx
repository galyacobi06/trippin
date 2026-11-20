import { render } from 'preact';
import './styles.css';
import { App } from './app.jsx';
import { startAutoSync } from './lib/sync.js';

render(<App />, document.getElementById('app'));
startAutoSync();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
// Ask the browser to keep our data even when storage is low.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
