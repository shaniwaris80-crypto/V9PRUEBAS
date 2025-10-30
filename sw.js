// ARSLAN PRO — sw.js (cache + offline)
const APP_VERSION = 'v1.0.0-kiwi';
const CACHE_NAME = `arslan-pro-${APP_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Add here your core assets to precache
const PRECACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/offline.html',
  // icons
  '/pwa-icons/icon-72x72.png',
  '/pwa-icons/icon-96x96.png',
  '/pwa-icons/icon-128x128.png',
  '/pwa-icons/icon-144x144.png',
  '/pwa-icons/icon-152x152.png',
  '/pwa-icons/icon-192x192.png',
  '/pwa-icons/icon-256x256.png',
  '/pwa-icons/icon-384x384.png',
  '/pwa-icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Strategy: Network-first for navigation (HTML), Cache-first for static assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cacheMatch = await caches.match(req);
        return cacheMatch || caches.match(OFFLINE_URL);
      }
    })());
    return;
  }

  // Same-origin static assets: cache-first
  if (url.origin === location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
  }
});
