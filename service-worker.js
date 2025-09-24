const CACHE_NAME = 'club-expense-cache-v3';
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

const networkFirst = async (request) => {
  try {
    const response = await fetch(request, { cache: 'reload' });
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
};

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const request = event.request;
  const destination = request.destination;

  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match('./index.html');
      })
    );
    return;
  }

  if (['style', 'script', 'worker'].includes(destination)) {
    event.respondWith(
      networkFirst(request).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }
      try {
        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
      } catch (error) {
        if (request.destination === 'document') {
          return cache.match('./index.html');
        }
        throw error;
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
