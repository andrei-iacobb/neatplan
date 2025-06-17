import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

// Array of public routes that don't require authentication
const publicRoutes = ['/auth', '/api/auth']

// Routes that only admins can access
const adminRoutes = [
  '/rooms',
  '/settings',
  '/schedule',
  '/upload',
  '/users'
]

// Routes that cleaners can access
const cleanerRoutes = [
  '/clean',
  '/api/cleaner'
]

export async function middleware(request: NextRequest) {
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
        const redirectPath = token.isAdmin ? '/' : '/clean'
        return NextResponse.redirect(new URL(redirectPath, request.url))
      }
      return NextResponse.next()
    }
    return NextResponse.next()
  }

  // Protect all other routes
  if (!token) {
    const redirectUrl = new URL('/auth', request.url)
    redirectUrl.searchParams.set('callbackUrl', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  const isAdmin = token.isAdmin as boolean
  const path = request.nextUrl.pathname

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