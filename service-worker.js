const CACHE_NAME = 'club-expense-cache-v2';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.jsx',
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

const REMOTE_ASSETS = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      await Promise.all(
        REMOTE_ASSETS.map(async (url) => {
          try {
            await cache.add(url);
          } catch (error) {
            console.warn('Asset caching skipped', url, error);
          }
        })
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = event.request.url;
  if (requestUrl.startsWith('chrome-extension')) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        const networkResponse = await fetch(event.request);
        cache.put(event.request, networkResponse.clone());
        return networkResponse;
      } catch (error) {
        if (event.request.mode === 'navigate') {
          return cache.match('./index.html');
        }
        return cache.match(event.request) || cache.match('./index.html');
      }
    })()
  );
});
