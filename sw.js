const CACHE_NAME = 'love-app-v53-room-visual-redesign';
const ASSETS_TO_CACHE = ['./index.html', './realtime.js?v=6', './together.js?v=27', './manifest.json', './styles_cleaned.css', './styles_elegant.css?v=9', './together.css?v=36', './app_refresh.css?v=5', './icono-app.png', './perfil_yo.jpg', './princesa2.jpg', './besos.jpg', './assets/plants/bedroom-calathea-states.webp', './assets/plants/bathroom-orchid-states.webp', './assets/plants/kitchen-cactus-states.webp'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method === 'GET') event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
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
