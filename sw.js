const CACHE_NAME = 'syndicate-library-v1';

// Core files to cache on install
const CORE_ASSETS = [
  '/awhtpwkuitsfs/',
  '/awhtpwkuitsfs/index.html',
  '/awhtpwkuitsfs/manifest.json',
];

// ─── INSTALL ───────────────────────────────────────────
// Runs once when SW is first registered
// Caches all core assets immediately
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS);
    })
  );
  // Activate immediately without waiting for old SW to die
  self.skipWaiting();
});

// ─── ACTIVATE ──────────────────────────────────────────
// Runs after install — cleans up any old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  // Take control of all open tabs immediately
  self.clients.claim();
});

// ─── FETCH ─────────────────────────────────────────────
// Intercepts every network request the app makes
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Don't intercept non-GET requests (POST, etc.)
  if (request.method !== 'GET') return;

  // Don't intercept requests to external domains
  // (your music files, APIs, etc. should always be fresh)
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      // Check cache first
      const cached = await cache.match(request);

      // Fetch fresh copy from network in background
      const fetchPromise = fetch(request)
        .then(networkResponse => {
          // Save fresh copy to cache for next time
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed — return cached version if available
          return cached;
        });

      // Return cached version instantly if available,
      // otherwise wait for network
      return cached || fetchPromise;
    })
  );
});

// ─── OFFLINE FALLBACK ──────────────────────────────────
// If both cache and network fail, show a simple message
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response(
        `<html>
          <body style="background:#000;color:#fff;display:flex;
          align-items:center;justify-content:center;height:100vh;
          font-family:sans-serif;text-align:center;">
            <div>
              <h2>You're Offline</h2>
              <p>Syndicate Library needs a connection to load new content.</p>
              <p>Previously loaded music may still be available.</p>
            </div>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    })
  );
});
