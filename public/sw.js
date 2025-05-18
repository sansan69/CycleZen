// Service Worker

// We are not using a specific cache name or URLs to cache for now to disable SW caching.
// const CACHE_NAME = 'cyclezen-cache-v1';
// const URLS_TO_CACHE = [
//   '/',
//   '/saved-routes',
//   '/manifest.json',
//   '/favicon.ico',
//   '/offline.html', 
//   // Add paths to your icons if they are not already covered by Next.js hashing
//   // e.g., '/icons/icon-192x192.png',
// ];

self.addEventListener('install', event => {
  console.log('[SW] Install event');
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting(); 
  // No pre-caching for now to ensure updates are seen quickly during development.
  // event.waitUntil(
  //   caches.open(CACHE_NAME)
  //     .then(cache => {
  //       console.log('[SW] Opened cache, caching app shell');
  //       return cache.addAll(URLS_TO_CACHE);
  //     })
  //     .catch(error => {
  //       console.error('[SW] Failed to cache app shell:', error);
  //     })
  // );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  // When the service worker is activated, claim control of all open clients.
  event.waitUntil(self.clients.claim());

  // Clean up old caches.
  // If you change CACHE_NAME above, old caches will be deleted.
  const currentCacheName = 'cyclezen-cache-v1'; // Keep this to clean up the old cache if it exists
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== currentCacheName && cacheName.startsWith('cyclezen-cache-')) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// By removing the 'fetch' event listener, the service worker will not intercept
// network requests for caching. The browser will handle all requests normally.
// This effectively "disables" service worker caching for development.

// self.addEventListener('fetch', event => {
//   // Let the browser handle requests for scripts and styles, as Next.js handles their caching.
//   if (event.request.url.includes('/_next/static/') || event.request.url.includes('/webpack-hmr')) {
//     return; 
//   }

//   // For navigation requests (HTML pages)
//   if (event.request.mode === 'navigate') {
//     event.respondWith(
//       fetch(event.request)
//         .then(response => {
//           // If network is available, cache the response for future offline use.
//           if (response.ok) {
//             const cacheCopy = response.clone();
//             caches.open(CACHE_NAME).then(cache => {
//               cache.put(event.request, cacheCopy);
//             });
//           }
//           return response;
//         })
//         .catch(() => {
//           // Network request failed, try to serve from cache
//           return caches.match(event.request)
//             .then(cachedResponse => {
//               if (cachedResponse) {
//                 return cachedResponse;
//               }
//               // If not in cache, serve the offline fallback page
//               return caches.match('/offline.html');
//             });
//         })
//     );
//     return;
//   }

//   // For other static assets (images, manifest, favicon) - Cache First, then Network
//   if (URLS_TO_CACHE.some(url => event.request.url.endsWith(url.startsWith('/') ? url : '/' + url))) {
//       event.respondWith(
//           caches.match(event.request)
//               .then(cachedResponse => {
//                   if (cachedResponse) {
//                       return cachedResponse;
//                   }
//                   return fetch(event.request).then(networkResponse => {
//                       if (networkResponse.ok) {
//                           const cacheCopy = networkResponse.clone();
//                           caches.open(CACHE_NAME).then(cache => {
//                               cache.put(event.request, cacheCopy);
//                           });
//                       }
//                       return networkResponse;
//                   });
//               })
//               .catch(() => {
//                   // If both cache and network fail (e.g., for an image not in offline.html scope)
//                   // and it's an image, you might return a placeholder image if you have one cached.
//                   // For now, just let it fail, which will result in browser's default behavior.
//               })
//       );
//       return;
//   }

//   // Default: network first for other requests (API calls, etc.)
//   // event.respondWith(fetch(event.request));
// });
