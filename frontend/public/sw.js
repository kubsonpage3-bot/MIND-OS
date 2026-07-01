const CACHE_NAME = 'mind-os-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/android/launchericon-48x48.png',
  '/android/launchericon-72x72.png',
  '/android/launchericon-96x96.png',
  '/android/launchericon-144x144.png',
  '/android/launchericon-192x192.png',
  '/android/launchericon-512x512.png'
];

// Install Service Worker and cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Service Worker and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch events: Stale-While-Revalidate strategy for static assets
self.addEventListener('fetch', (event) => {
  // Only cache GET requests
  if (event.request.method !== 'GET') {
    // For non-GET requests (POST, PATCH, DELETE) to API, just fetch directly
    return;
  }
  
  const url = event.request.url;

  // 1. All requests to the API domain must bypass both SW and Browser HTTP cache
  if (url.includes('/api/') || url.includes('mind-os-d5sk.onrender.com')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch((err) => {
        throw err;
      })
    );
    return;
  }

  // Ignore hot-reloads or chrome extensions
  if (!url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh in background and update cache
        fetch(event.request).then((response) => {
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response);
            });
          }
        }).catch(() => {/* ignore fetch errors offline */});
        return cachedResponse;
      }

      // Fallback to network
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        // Cache newly requested assets (like dynamically built js/css files)
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch((err) => {
        // Network failed (offline or 404). Fallback to cache if available.
        return caches.match(event.request).then((fallbackResponse) => {
          if (fallbackResponse) {
            return fallbackResponse;
          }
          throw err;
        });
      });
    })
  );
});
