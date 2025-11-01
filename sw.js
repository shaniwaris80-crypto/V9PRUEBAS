// Nombre del caché (puedes cambiar la versión si haces cambios grandes)
const CACHE_NAME = 'arslan-fruit-v1';

// Archivos que se guardarán para funcionar sin conexión
// 👇 Usamos rutas relativas (sin "/" al inicio) para que GitHub Pages no falle
const CACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './supabaseClient.js' // opcional, solo si existe en tu carpeta
];

// Cuando se instala el Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker instalado');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(CACHE_ASSETS);
      })
      .catch(err => console.warn('⚠️ Error guardando en caché:', err))
  );
});

// Cuando se activa el nuevo SW (limpia versiones viejas)
self.addEventListener('activate', event => {
  console.log('Service Worker activado');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
});

// Intercepta las peticiones y sirve desde caché si está disponible
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // Si está en caché → úsalo
      if (response) return response;
      // Si no, pide a la red y guarda una copia
      return fetch(event.request).then(fetchRes => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, fetchRes.clone());
          return fetchRes;
        });
      }).catch(err => {
        console.warn('❌ Error en fetch:', err);
      });
    })
  );
});
