const CACHE_NAME = 'syndicate-library-v2';

const CORE_ASSETS = [
  '/awhtpwkuitsfs/',
  '/awhtpwkuitsfs/index.html',
  '/awhtpwkuitsfs/manifest.json',
  '/awhtpwkuitsfs/splash.png',
  '/awhtpwkuitsfs/stylium.css',
  '/awhtpwkuitsfs/themium.css',
  '/awhtpwkuitsfs/playerExpanded.css',
  '/awhtpwkuitsfs/data.js',
  '/awhtpwkuitsfs/accounts.js',
  '/awhtpwkuitsfs/settings.js',
  '/awhtpwkuitsfs/audioEngine.js',
  '/awhtpwkuitsfs/stats.js',
  '/awhtpwkuitsfs/search.js',
  '/awhtpwkuitsfs/lyricsMap.js',
  '/awhtpwkuitsfs/aui.js',
  '/awhtpwkuitsfs/readySystem.js',
  '/awhtpwkuitsfs/urlStateModule.js',
  '/awhtpwkuitsfs/init.js',
  '/awhtpwkuitsfs/pageSet.js',
  '/awhtpwkuitsfs/404ALBUM.png',
  '/awhtpwkuitsfs/default.png',
];

// ─── INSTALL ───────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS);
    }).catch(err => {
      console.warn('[SW] Cache install partial failure:', err);
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── FETCH ─────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET
  if (request.method !== 'GET') return;

  // Never cache audio/music streams — always fetch fresh
  if (
    url.pathname.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/i) ||
    url.hostname.includes('docs.google.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('drive.google.com')
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first for same-origin assets, network-fallback for external
  if (url.origin === location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then(res => {
            if (res && res.status === 200) {
              cache.put(request, res.clone());
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
  } else {
    // External resources (CDN fonts, icons) — network with cache fallback
    event.respondWith(
      caches.open(CACHE_NAME).then(async cache => {
        const cached = await cache.match(request);
        try {
          const res = await fetch(request);
          if (res && res.status === 200) {
            cache.put(request, res.clone());
          }
          return res;
        } catch {
          return cached || new Response('', { status: 503 });
        }
      })
    );
  }
});
