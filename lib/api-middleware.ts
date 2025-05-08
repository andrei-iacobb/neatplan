import { NextResponse } from "next/server"
import { verify } from "jsonwebtoken"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

interface DecodedToken {
  userId: string
  username: string
  role: string
  iat: number
  exp: number
}

// This middleware can be used in API routes to verify authentication
// It supports both NextAuth session and JWT token (for mobile app)
export async function apiAuthMiddleware(request: Request) {
  try {
    // First, try to get the session (for web app)
    const session = await getServerSession(authOptions)

    if (session?.user) {
      return {
        isAuthenticated: true,
        user: {
          userId: session.user.id,
          username: session.user.name,
          role: session.user.role,
        },
      }
    }

    // If no session, try to get the token from Authorization header (for mobile app)
    const authHeader = request.headers.get("authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { isAuthenticated: false }
    }

    // Extract the token
    const token = authHeader.split(" ")[1]

    // Verify the token
    const decoded = verify(
      token,
      process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "default_secret",
    ) as DecodedToken

    return {
      isAuthenticated: true,
      user: {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role,
      },
    }
  } catch (error) {
    console.error("API auth verification error:", error)
    return { isAuthenticated: false }
  }
}

// Helper function to create an unauthorized response
export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

// Helper function to create a forbidden response
export function forbiddenResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
