const CACHE_NAME = 'love-app-v55-reliable-updates';
const ASSETS_TO_CACHE = ['./index.html', './realtime.js?v=6', './together.js?v=28', './manifest.json', './styles_cleaned.css', './styles_elegant.css?v=9', './together.css?v=37', './app_refresh.css?v=5', './icono-app.png', './perfil_yo.jpg', './princesa2.jpg', './besos.jpg', './assets/plants/bedroom-calathea-states.webp', './assets/plants/bathroom-orchid-states.webp', './assets/plants/kitchen-cactus-states.webp'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(ASSETS_TO_CACHE.map(async asset => {
      try {
        const request = new Request(asset, { cache:'reload' });
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response);
      } catch (error) {
        console.warn('No se pudo precargar', asset, error);
      }
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const isNavigation = event.request.mode === 'navigate';
  const isCode = /\.(?:html|js|css|json)$/.test(requestUrl.pathname);
  if (isNavigation || isCode) {
    event.respondWith((async () => {
      try {
        const freshRequest = new Request(event.request, { cache:'no-store' });
        const response = await fetch(freshRequest);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          const cacheKey = isNavigation ? new Request('./index.html') : event.request;
          await cache.put(cacheKey, response.clone());
        }
        return response;
      } catch {
        const cached = await (isNavigation ? caches.match('./index.html') : caches.match(event.request));
        return cached || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, response.clone());
    }
    return response;
  })());
});
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { body: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(payload.title || 'KoalaApp 💌', {
    body: payload.body || 'Tenés un mensaje nuevo', icon: './icono-app.png', badge: './icono-app.png',
    tag: payload.tag || 'love-message', renotify: true, data: payload.data || {}
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(item => new URL(item.url).origin === self.location.origin);
    if (existing) { await existing.focus(); existing.postMessage({ type: 'notification-click', data: event.notification.data }); }
    else {
      const type = event.notification.data?.type;
      const destination = type === 'drawing' ? './index.html#drawing'
        : (type === 'house-note' || type === 'heart' || type === 'house-light' || type === 'house-wake') ? './index.html#together'
        : './index.html';
      await clients.openWindow(destination);
    }
  })());
});
