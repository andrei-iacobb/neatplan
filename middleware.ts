import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Define public paths that don't require authentication
  const isPublicPath = path === "/" || path === "/login" || path === "/register"

  // Define API paths that use token-based auth (for mobile app)
  const isApiPath = path.startsWith("/api/")

  // Check if the user is authenticated
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
  })

  // Redirect logic for web pages
  if (!isApiPath) {
    // If the path requires authentication and the user is not authenticated
    if (!isPublicPath && !token) {
      return NextResponse.redirect(new URL("/login", request.url))
    }

    // If the user is already authenticated and trying to access login/register
    if (isPublicPath && token) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return NextResponse.next()
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    // Apply to all paths except API routes that handle their own auth
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
}
