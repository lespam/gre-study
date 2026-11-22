// Cambia VERSION cuando edites archivos de la app para forzar actualización.
const VERSION = 'gre-study-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'data/index.json', 'data/vocabulary.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Stale-while-revalidate: abre rápido sin red y se actualiza en segundo plano.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
