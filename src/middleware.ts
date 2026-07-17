import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

// Array of public routes that don't require authentication
const publicRoutes = ['/auth', '/api/auth', '/demo', '/api/health', '/api/readyz']

// Routes that only admins can access
const adminRoutes = [
  '/rooms',
  '/settings',
  '/schedule',
  '/upload',
  '/users',
  '/audit',
  '/equipment',
  '/sites'
]

// Routes that cleaners can access
const cleanerRoutes = [
  '/clean',
  '/api/cleaner'
]

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // 0) Let public static assets and PWA files through without auth so logged-out pages
  // (login, demo) render their logo/manifest/service worker. Fixes the broken-image and
  // "script behind a redirect" errors that disabled the PWA for not-yet-logged-in users.
  // API routes are never treated as static.
  if (!path.startsWith('/api') && isStaticAsset(path)) {
    return NextResponse.next()
  }

  // 1) IP whitelist enforcement
  // Set ALLOWED_IPS in env as comma-separated list of exact IPv4 addresses or CIDR ranges (e.g.,
  // "203.0.113.10,198.51.100.0/24"). If empty or unset, no IP restriction is applied.
  const allowedIpsEnv = (process.env.ALLOWED_IPS ?? '').trim()
  const enforce = process.env.IP_WHITELIST_ENFORCE === 'true' || allowedIpsEnv.length > 0
  if (enforce) {
    const clientIp = getClientIp(request)
    const isAllowed = isIpAllowed(clientIp, allowedIpsEnv)

    if (!isAllowed) {
      // Deny all API/data access with 403
      if (path.startsWith('/api')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      // Allow demo route and required static assets only; redirect everything else to /demo
      const isDemoRoute = path === '/demo' || path.startsWith('/_next') || path === '/favicon.ico'
      if (!isDemoRoute) {
        const url = new URL('/demo', request.url)
        return NextResponse.redirect(url)
      }
      // Already on demo/static — allow through without auth
      return NextResponse.next()
    }
  }

  // Allow scheduled cron route with shared secret only
  if (path.startsWith('/api/cron')) {
    // SECURITY: Only accept secret via header, not query parameter to prevent logging.
    // Note: x-vercel-cron header alone is not sufficient as it can be spoofed.
    // Middleware runs before the route handler, so this comparison is the effective gate -
    // it must be constant-time. The Edge runtime has no node crypto.timingSafeEqual, so we
    // use a pure-JS constant-time compare.
    const providedSecret = request.headers.get('x-cron-secret')
    const expectedSecret = process.env.CRON_SECRET

    if (expectedSecret && constantTimeEqual(providedSecret, expectedSecret)) {
      return NextResponse.next()
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = await getToken({ req: request })
  
  // Check if the current path is a public route
  const isPublicRoute = publicRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  // Handle public routes
  if (isPublicRoute) {
    if (token) {
      // If user is authenticated and tries to access auth page, redirect to appropriate dashboard
      if (request.nextUrl.pathname.startsWith('/auth')) {
        const mustChange = (token as any).forcePasswordChange === true
        const desiredPath = mustChange ? '/auth/change-password' : (token.isAdmin ? '/' : '/clean')
        // Avoid redirect loop when already on the change-password page
        if (request.nextUrl.pathname !== '/auth/change-password' || !mustChange) {
          return NextResponse.redirect(new URL(desiredPath, request.url))
        }
      }
      return NextResponse.next()
    }
    return NextResponse.next()
  }

  // Protect all other routes
  if (!token) {
    const redirectUrl = new URL('/auth', request.url)
    const callbackBase = process.env.NEXTAUTH_URL || request.url
    const callbackUrl = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, callbackBase)
    redirectUrl.searchParams.set('callbackUrl', callbackUrl.toString())
    return NextResponse.redirect(redirectUrl)
  }

  // Enforce password change before accessing app
  const mustChange = (token as any).forcePasswordChange === true
  if (mustChange) {
    const isChangePasswordPage = path.startsWith('/auth/change-password')
    const isChangePasswordApi = path.startsWith('/api/auth/change-password')
    const isAuthStatic = path.startsWith('/_next') || path.startsWith('/favicon.ico')
    if (!isChangePasswordPage && !isChangePasswordApi && !isAuthStatic) {
      return NextResponse.redirect(new URL('/auth/change-password', request.url))
    }
  }

  const isAdmin = token.isAdmin as boolean

  // Check if the user is trying to access admin routes
  if (adminRoutes.some(route => path.startsWith(route))) {
    if (!isAdmin) {
      // Redirect non-admin users to cleaner dashboard
      return NextResponse.redirect(new URL('/clean', request.url))
    }
  }

  // Check if the user is trying to access cleaner routes
  if (cleanerRoutes.some(route => path.startsWith(route))) {
    if (isAdmin) {
      // Redirect admin users to admin dashboard
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Handle root path based on role
  if (path === '/') {
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/clean', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  // Protect all routes except public assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
} 

// Helpers
// Edge-runtime-safe constant-time string comparison (node's crypto.timingSafeEqual is not
// available in middleware). Returns false for a missing/wrong-length secret without an
// early length-dependent branch on the compare itself.
function constantTimeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

function isStaticAsset(path: string): boolean {
  if (
    path.startsWith('/assets') ||
    path.startsWith('/icons') ||
    path.startsWith('/images') ||
    path === '/manifest.json' ||
    path === '/manifest.webmanifest' ||
    path === '/sw.js' ||
    path === '/robots.txt' ||
    path === '/sitemap.xml'
  ) {
    return true
  }
  return /\.(?:png|jpe?g|gif|svg|ico|webp|avif|css|js|mjs|map|json|txt|woff2?|ttf|otf|eot|webmanifest)$/i.test(path)
}

// Resolve the real client IP for the allowlist decision. The previous implementation
// trusted the FIRST X-Forwarded-For entry, which is fully client-controlled and lets an
// attacker spoof an allowlisted address. Instead we trust the hop appended by our own
// reverse proxy: Cloudflare's CF-Connecting-IP when present (cloudflared tunnel), otherwise
// the Nth-from-last XFF entry where N = TRUSTED_PROXY_COUNT (default 1).
function getClientIp(request: NextRequest): string {
  const cf = normalizeIp(request.headers.get('cf-connecting-ip') || '')
  if (cf) return cf

  const trusted = Math.max(1, Number(process.env.TRUSTED_PROXY_COUNT) || 1)
  const xff = request.headers.get('x-forwarded-for') || ''
  const chain = xff.split(',').map(x => normalizeIp(x.trim())).filter(Boolean)
  if (chain.length > 0) {
    const idx = Math.max(0, chain.length - trusted)
    const candidate = chain[idx]
    if (candidate) return candidate
  }

  const xri = normalizeIp(request.headers.get('x-real-ip') || '')
  if (xri) return xri
  const reqIp = normalizeIp((request as any).ip || '')
  if (reqIp) return reqIp
  return '0.0.0.0'
}

function isIpAllowed(ip: string, allowedCsv: string): boolean {
  const rules = allowedCsv.split(',').map(r => r.trim()).filter(Boolean)
  for (const rule of rules) {
    if (rule.toLowerCase() === 'localhost') {
      if (ip === '127.0.0.1') return true
    }
    if (rule.includes('/')) {
      if (ipv4CidrMatch(ip, rule)) return true
    } else {
      if (ip === rule) return true
    }
  }
  return false
}

function normalizeIp(ip: string): string {
  // IPv6 loopback
  if (ip === '::1') return '127.0.0.1'
  // IPv6-mapped IPv4, e.g. ::ffff:127.0.0.1
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return mapped[1]
  return ip
}

function ipv4ToLong(ip: string): number {
  const parts = ip.split('.').map(p => parseInt(p, 10))
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n) || n < 0 || n > 255)) return -1
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

function ipv4CidrMatch(ip: string, cidr: string): boolean {
  const [base, maskBitsStr] = cidr.split('/')
  const maskBits = parseInt(maskBitsStr || '32', 10)
  if (Number.isNaN(maskBits) || maskBits < 0 || maskBits > 32) return false
  const ipLong = ipv4ToLong(ip)
  const baseLong = ipv4ToLong(base)
  if (ipLong < 0 || baseLong < 0) return false
  const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0
  return (ipLong & mask) === (baseLong & mask)
}
