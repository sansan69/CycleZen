// Basic service worker
const CACHE_NAME = 'cyclezen-cache-v1';
const urlsToCache = [
  '/',
  '/saved-routes',
  // IMPORTANT: Add paths to your actual icon files here once you create them
  // e.g., '/icons/icon-192x192.png', '/icons/icon-512x512.png'
  // For now, we are not caching the placeholder icons from placehold.co
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Opened cache');
        return cache.addAll(urlsToCache.filter(url => !url.startsWith('https://placehold.co'))); // Avoid caching external placeholders
      })
      .catch(error => {
        console.error('Service Worker: Failed to cache during install', error);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  // We only want to cache GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // For navigation requests, try network first, then cache, then offline page (optional)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If successful, clone and cache it
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try to serve from cache
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Optional: return a generic offline fallback page if even cache fails
              // return caches.match('/offline.html'); 
              // For this, you would need to create an offline.html and cache it.
              // For now, let the browser handle the offline error for navigation.
              return new Response("Network error and not in cache.", {
                status: 408,
                headers: { 'Content-Type': 'text/plain' },
              });
            });
        })
    );
    return;
  }

  // For other requests (CSS, JS, images), use a cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Serve from cache
        }
        // If not in cache, fetch from network and cache it
        return fetch(event.request).then(
          networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              // Do not cache responses from placehold.co or other external dynamic image services
              if (!networkResponse.url.includes('placehold.co')) {
                 const responseToCache = networkResponse.clone();
                 caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, responseToCache);
                  });
              }
            }
            return networkResponse;
          }
        ).catch(() => {
           // For non-navigation, if fetch fails and not in cache, browser will show its default error
        });
      })
  );
});
