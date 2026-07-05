const CACHE = 'neatplan-shell-v2'
const SHELL = ['/', '/auth', '/clean']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL))
  )
  self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)

  // Never intercept API, Next.js internals, or full page navigations
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/_next') ||
    event.request.mode === 'navigate'
  ) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  )
})
