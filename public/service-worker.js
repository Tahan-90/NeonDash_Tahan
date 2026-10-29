const CACHE_NAME = 'neon-dash-shell-v14';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/app-icon.svg',
  './icons/icon-192.webp',
  './icons/icon-512.webp',
  './assets/ships/dart.svg',
  './assets/ships/ghost.svg',
  './assets/ships/titan.svg',
  './assets/ships/falcon.svg',
  './assets/ships/sokol.svg',
  './assets/ships/longyu.svg',
  './assets/ships/mirage.svg',
  './assets/ships/comet.svg',
  './assets/ships/tempest.svg',
  './assets/ships/wasp.svg',
  './assets/ships/atlas.svg',
  './assets/ships/kestrel.svg',
  './assets/ships/ember.svg',
  './assets/ships/aurora.svg',
  './assets/ships/frost.svg',
  './assets/ships/midas.svg',
  './assets/worlds/neon-grid.svg',
  './assets/worlds/sunset-circuit.svg',
  './assets/worlds/deep-space.svg',
  './assets/worlds/toxic-core.svg',
  './assets/worlds/void-run.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await cache.addAll(APP_SHELL);
    const response = await fetch('./index.html');
    if (!response.ok) throw new Error('Could not load the game shell for offline caching.');
    const html = await response.text();
    const entryAssets = [...html.matchAll(/\b(?:src|href)="([^"]+\.(?:js|css))"/g)]
      .map((match) => match[1]);
    await cache.addAll(entryAssets);
  }));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => cached || fetch(request).then((response) => {
      if (!response.ok) return response;
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    })),
  );
});
