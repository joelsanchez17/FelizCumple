const CACHE_NAME = 'love-app-v1';
const ASSETS_TO_CACHE = [
  './index.html',
  './realtime.js',
  'https://unpkg.com/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=Pacifico&family=Quicksand:wght@400;700&display=swap'
  // Aquí podrías añadir tus imágenes principales si quieres que carguen offline
  // './princesa.jpg',
];

// 1. Instalación: Guardamos lo básico
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

// 2. Activación: Limpiamos cachés viejos si actualizas la versión
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
});

// 3. Interceptar peticiones (Estrategia Híbrida)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    (async () => {
      // Intentar ir a la red primero (para que vea tus cambios siempre)
      try {
        const networkResponse = await fetch(e.request);
        return networkResponse;
      } catch (error) {
        // Si no hay internet, usar el caché
        const cachedResponse = await caches.match(e.request);
        if (cachedResponse) return cachedResponse;
        // Si no está en caché ni hay red, podrías retornar una página de error custom
        throw error;
      }
    })()
  );
});