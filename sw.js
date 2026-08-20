const CACHE_NAME = 'love-app-v7-push-registration';
const ASSETS_TO_CACHE = ['./index.html', './realtime.js', './manifest.json', './styles_cleaned.css', './styles_elegant.css', './icono-app.png'];

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
    else await clients.openWindow(event.notification.data?.type === 'drawing' ? './index.html#drawing' : './index.html');
  })());
});
