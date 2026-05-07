// ── Service Worker — Network First ──────────────────────────────────────────
// Always fetches fresh from network. Cache is only a fallback when offline.
// Cache version auto-incremented by deploy timestamp.

const CACHE_NAME = 'thesis-coord-' + self.registration.scope

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  // Delete ALL old caches on activate
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  if (event.request.url.startsWith('chrome-extension')) return
  if (event.request.url.includes('supabase')) return
  if (event.request.url.includes('emailjs')) return
  if (event.request.url.includes('script.google.com')) return

  // Network first — always try to get fresh content
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache the fresh response for offline fallback
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() =>
        // Only use cache if network fails (offline)
        caches.match(event.request)
      )
  )
})
