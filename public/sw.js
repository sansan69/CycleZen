const CACHE_NAME = 'cyclezen-cache-v2'; // Incremented version
const OFFLINE_URL = '/offline.html';
const ASSETS_TO_CACHE = [
  '/',
  '/saved-routes',
  '/manifest.json',
  '/favicon.ico',
  OFFLINE_URL,
  // Add paths to specific icons if they are critical for the offline shell
  // e.g., '/icons/icon-192x192.png', '/icons/icon-512x512.png'
  // Next.js built JS/CSS are typically versioned, so caching them by specific name here is fragile.
  // The strategy below handles them.
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Opened cache and caching core assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting()) // Force activation of new SW
      .catch(error => {
        console.error('[Service Worker] Failed to cache assets during install:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all clients
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // For navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try network first
          const networkResponse = await fetch(request);
          return networkResponse;
        } catch (error) {
          // Network failed, try cache
          console.log('[Service Worker] Network request for navigation failed, trying cache for:', request.url);
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Not in cache, serve offline page
          console.log('[Service Worker] Not in cache, serving offline page for:', request.url);
          return await caches.match(OFFLINE_URL);
        }
      })()
    );
    return;
  }

  // For static assets (images, manifest, favicon etc.) - Cache First, then Network
  // This includes assets from placehold.co and img.redbull.com
  if (request.destination === 'image' || 
      request.url.endsWith('/manifest.json') || 
      request.url.endsWith('/favicon.ico')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          // Optionally cache new static assets dynamically if needed
          // For now, relying on install-time caching for these.
          return networkResponse;
        });
      })
    );
    return;
  }
  
  // For Next.js JS/CSS chunks and other assets - Cache first, then Network
  // These are often versioned, so if they are in cache, they are good.
  if (request.url.includes('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          // Cache these as they are fetched.
          // This helps if some chunks were not part of the initial ASSETS_TO_CACHE
          // (e.g. dynamically loaded component chunks)
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // For other requests (APIs like OpenRouteService, Google Maps API, Firestore)
  // It's generally safer to let them go to network or be handled by their respective SDKs.
  // Firebase SDK has its own offline persistence.
  // Google Maps API also has complex loading.
  // Attempting to cache these generically can lead to issues.
  // So, default is network only for these.
  event.respondWith(fetch(request).catch(() => {
    // For API calls, if network fails, we don't have a generic offline response
    // other than what the app itself might display.
    // For Firestore, its SDK will handle offline queueing.
    if (request.destination !== 'document') { // avoid serving offline.html for failed API calls.
        // Could return a generic error response if desired for certain API patterns
        // For now, let the browser handle the network error for non-navigation fetch
    }
    // Fallback for other types of failed requests if needed, but often just letting it fail is okay.
  }));
});
