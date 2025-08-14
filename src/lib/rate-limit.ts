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

function getClientIp(request: RequestLike): string {
  const headers = request.headers
  const xff = headers.get('x-forwarded-for') || ''
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp =
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    headers.get('x-client-ip') ||
    headers.get('fastly-client-ip') ||
    headers.get('true-client-ip')
  if (realIp) return realIp
  return '127.0.0.1'
}

function checkAndUpdateWindow(key: string, limit: number, windowMs: number): RateLimitResult {
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



