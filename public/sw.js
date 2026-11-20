// TRIPPIN service worker: keeps the whole app available offline.
const VERSION = '__VERSION__';
const CACHE = 'trippin-app-' + VERSION;
const RUNTIME = 'trippin-runtime';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('trippin-app-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App files: cache first (they're versioned), fall back to network.
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      event.respondWith(fetch(req).catch(() => caches.match('./', { ignoreSearch: true, ignoreVary: true })));
      return;
    }
    event.respondWith(caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || fetch(req)));
    return;
  }

  // Place photos and map tiles from the web: keep a copy so they show offline.
  if (/wikimedia\.org|wikipedia\.org/.test(url.hostname) && req.destination === 'image') {
    event.respondWith(
      caches.open(RUNTIME).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok || res.type === 'opaque') c.put(req, res.clone());
          return res;
        } catch (e) {
          return hit || Response.error();
        }
      })
    );
  }
});
