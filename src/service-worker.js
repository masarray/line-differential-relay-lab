const CACHE_NAME = 'line-differential-relay-lab-v17';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './favicon.svg',
  './manifest.webmanifest',
  './social-preview.png',
  './ui/waveform-renderer.js',
  './ui/relay-latch.js',
  './ui/presentation-waveform.js',
  './ui/virtual-relay-panel.js',
  './ui/analysis-panel.js',
  './ui/relay-experience.js',
  './worker/simulation-worker.js',
  './engine/constants.js',
  './engine/random.js',
  './engine/math.js',
  './engine/signal-model.js',
  './engine/channel-model.js',
  './engine/algorithms.js',
  './engine/confidence.js',
  './engine/state-machine.js',
  './engine/safety-invariants.js',
  './engine/schema.js',
  './engine/simulation.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }))
  );
});
