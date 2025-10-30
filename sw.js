// sw.js — Service Worker básico para PWA ARSLAN PRO
self.addEventListener('install', event => {
  console.log('Service Worker instalado');
  event.waitUntil(
    caches.open('arslan-pro-cache-v1').then(cache => {
      return cache.addAll([
        './',
        './index.html',
        './style.css',
        './app.js',
        './logo.png',
        './manifest.json'
      ]);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', () => {
  console.log('Service Worker activado');
});
