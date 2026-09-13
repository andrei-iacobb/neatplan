const CACHE = 'neatplan-shell-v4'
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

/*
 * Push notifications.
 *
 * The payload is encrypted end to end by the push service, so this is the first
 * point at which it is readable. It is still parsed defensively: a malformed or
 * empty push must show something rather than throwing inside the worker, where
 * nobody would ever see the error.
 */
/** A same-origin path, or '/' - never an absolute, javascript: or data: URL. */
function safePath(value) {
  if (typeof value !== 'string') return '/'
  // A leading double slash is protocol-relative and would leave the origin.
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = payload.title || 'NeatPlan'
  const options = {
    body: payload.body || 'There is an update waiting in NeatPlan.',
    icon: '/assets/logos/logo-192.png',
    badge: '/assets/logos/logo-192.png',
    // A tag replaces an earlier notification with the same one, so five overdue
    // alerts do not become five entries in the tray.
    tag: payload.tag || 'neatplan',
    // Only a path on this origin. A payload is only attacker-influenced if the
    // VAPID key or a device's keys are already compromised, but navigating to
    // whatever a push says is not a capability worth keeping for that day.
    data: { url: safePath(payload.url) },
    // Work due today is worth a buzz; a silent notification on a trolley tablet
    // is one nobody looks at.
    requireInteraction: false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const target = safePath(event.notification.data && event.notification.data.url)

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus a tab that is already open rather than opening a second one. A
      // cleaner with four NeatPlan tabs is a cleaner who has lost their place.
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})

/*
 * A push service can rotate a subscription without being asked. Without this the
 * old endpoint quietly stops working and the user believes they are still
 * subscribed.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription ? event.oldSubscription.options : undefined)
      .then((subscription) =>
        fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        })
      )
      .catch(() => {
        // Nothing useful to do from here. The settings page re-checks on load
        // and will offer to subscribe again.
      })
  )
})
