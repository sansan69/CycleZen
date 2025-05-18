
const CACHE_NAME = 'cyclezen-cache-v2'; // Increment version if you make significant changes to cached assets
const OFFLINE_URL = '/offline.html';
const CORE_ASSETS = [
  '/',
  '/saved-routes',
  '/profile',
  '/manifest.json',
  '/favicon.ico',
  '/offline.html',
  // Add paths to your PWA icons here once created, e.g.:
  // '/icons/icon-192x192.png',
  // '/icons/icon-512x512.png',
];

// Install service worker: Open cache and add core assets.
self.addEventListener('install', event => {
  console.log('[Service Worker] Install event');
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('[Service Worker] Caching core assets');
      try {
        await cache.addAll(CORE_ASSETS);
      } catch (error) {
        console.error('[Service Worker] Failed to cache core assets:', error);
        // If any core asset fails, it's problematic. Depending on importance,
        // you might choose not to `self.skipWaiting()` or handle differently.
      }
      self.skipWaiting(); // Force the waiting service worker to become the active service worker.
    })()
  );
});

// Activate service worker: Clean up old caches.
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate event');
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
      await self.clients.claim(); // Ensure the new service worker takes control of open clients immediately.
    })()
  );
});

// Fetch event: Handle requests.
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Serve Next.js specific assets (/_next/) from cache first if available
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // If not in cache, fetch from network and cache it
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(error => {
        console.warn(`[Service Worker] Fetch error for _next asset ${request.url}:`, error);
        // Fallback for _next assets could be just to re-throw, or attempt offline page if critical for startup
        // For now, just let the browser handle the failure.
      })
    );
    return;
  }
  
  // For static assets (images, manifest, favicon - already in CORE_ASSETS or similar paths)
  // Use a Cache First, then Network strategy.
  if (/\.(png|jpg|jpeg|gif|svg|ico|webmanifest)$/i.test(url.pathname) || CORE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        const networkResponse = await fetch(request);
        // Don't cache responses that are not ok (e.g. 404)
        if (networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(error => {
        console.warn(`[Service Worker] Fetch error for static asset ${request.url}:`, error);
        // Potentially return a placeholder if appropriate for images, etc.
      })
    );
    return;
  }

  // For navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Try network first
          const networkResponse = await fetch(request);
          // Cache the successful response for future offline use
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          console.log('[Service Worker] Network request failed, trying cache for:', request.url);
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // If both network and cache fail, serve the offline page
          console.log('[Service Worker] Serving offline page for:', request.url);
          const offlinePageCache = await caches.open(CACHE_NAME); // Ensure it's from the same cache
          return await offlinePageCache.match(OFFLINE_URL);
        }
      })()
    );
    return;
  }

  // For other types of requests (e.g., API calls to OpenRouteService, Firestore)
  // typically you'd want a network-first or network-only strategy.
  // Firestore has its own offline persistence, so we let it handle its requests.
  // OpenRouteService and Google Maps API calls need the network.
  if (url.hostname === 'api.openrouteservice.org' || url.hostname.endsWith('.googleapis.com')) {
    // Network only for these external APIs
    event.respondWith(fetch(request).catch(error => {
      console.warn(`[Service Worker] API request failed for ${request.url}:`, error);
      // For API calls, you might return a custom JSON response indicating offline status
      // For now, just let the browser handle the failure
      return new Response(JSON.stringify({ error: 'Offline, API request failed' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 503, // Service Unavailable
      });
    }));
    return;
  }

  // Default: try cache, then network (good for app shell assets not explicitly listed)
  // This is a general fallback, but the specific handlers above should cover most cases.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      try {
        const networkResponse = await fetch(request);
        // Don't cache responses that are not ok
        if (networkResponse.ok && request.method === 'GET') { // Only cache GET requests
           // Be careful about caching opaque responses or large dynamic content unintentionally
           // For instance, ensure this doesn't cache API calls that weren't caught by specific handlers
           if (!url.pathname.startsWith('/api/') && !url.hostname.includes('openrouteservice') && !url.hostname.includes('googleapis')) {
             cache.put(request, networkResponse.clone());
           }
        }
        return networkResponse;
      } catch (error) {
        console.warn(`[Service Worker] Default fetch strategy failed for ${request.url}:`, error);
        // If it's a navigation request not caught by the specific navigation handler, try offline page
        if (request.mode === 'navigate') {
            const offlinePageCache = await caches.open(CACHE_NAME);
            return await offlinePageCache.match(OFFLINE_URL);
        }
      }
    })
  );
});
