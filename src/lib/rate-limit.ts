type RequestLike = Request & { headers: Headers }

type RateLimitResult = {
  allowed: boolean
  retryAfterSeconds: number
  remaining: number
}

const globalStore = (globalThis as unknown as {
  __rateLimitStore?: Map<string, number[]>
}).__rateLimitStore || new Map<string, number[]>()

if (!(globalThis as any).__rateLimitStore) {
  ;(globalThis as any).__rateLimitStore = globalStore
}

// Periodic cleanup of stale entries (run every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000
const MAX_WINDOW_MS = 60 * 60 * 1000 // 1 hour max window

let lastCleanup = Date.now()

function cleanupStaleEntries() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  const cutoff = now - MAX_WINDOW_MS
  for (const [key, hits] of globalStore.entries()) {
    const recent = hits.filter(ts => ts > cutoff)
    if (recent.length === 0) {
      globalStore.delete(key)
    } else {
      globalStore.set(key, recent)
    }
  }
}

function getClientIp(request: RequestLike): string {
  const headers = request.headers
  // Use x-forwarded-for first entry (should be set by reverse proxy)
  const xff = headers.get('x-forwarded-for') || ''
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp
  return '127.0.0.1'
}

function checkAndUpdateWindow(key: string, limit: number, windowMs: number): RateLimitResult {
  // Run periodic cleanup
  cleanupStaleEntries()

  const now = Date.now()
  const windowStart = now - windowMs
  const hits = globalStore.get(key) || []
  const recentHits = hits.filter(ts => ts > windowStart)

  if (recentHits.length >= limit) {
    const earliest = Math.min(...recentHits)
    const retryAfterMs = windowMs - (now - earliest)
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      remaining: 0,
    }
  }

  recentHits.push(now)
  globalStore.set(key, recentHits)

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, limit - recentHits.length),
  }
}

export function checkRateLimitByIp(
  request: RequestLike,
  endpointKey: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const ip = getClientIp(request)
  const key = `${endpointKey}:ip:${ip}`
  return checkAndUpdateWindow(key, limit, windowMs)
}

export function checkRateLimitByUserOrIp(
  request: RequestLike,
  endpointKey: string,
  limit: number,
  windowMs: number,
  userIdOrEmail?: string | null
): RateLimitResult {
  const identifier = userIdOrEmail || getClientIp(request)
  const key = `${endpointKey}:id:${identifier}`
  return checkAndUpdateWindow(key, limit, windowMs)
}
