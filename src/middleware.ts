import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })
  const isAuthPage = request.nextUrl.pathname === '/auth'

  if (isAuthPage) {
    if (token) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  if (!token) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  // Redirect /dashboard to / for authenticated users
  if (request.nextUrl.pathname === '/dashboard') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/auth', '/dashboard', '/rooms/:path*', '/cleaning/:path*', '/settings/:path*', '/schedule/:path*']
} 