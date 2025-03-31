import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { sign } from "jsonwebtoken"
import { authOptions } from "@/lib/auth"

// This endpoint is for mobile app authentication
// It returns a JWT token that can be used with the API
export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    // Use the same credentials provider logic
    const res = await fetch(`${process.env.NEXTAUTH_URL}/api/auth/callback/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, redirect: false, callbackUrl: "/" }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Get the session to extract user data
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401 })
    }

    // Generate JWT token for mobile app
    const token = sign(
      {
        userId: session.user.id,
        username: session.user.name,
        role: session.user.role,
      },
      process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "default_secret",
      { expiresIn: "7d" },
    )

    return NextResponse.json({
      access_token: token,
      user: {
        id: session.user.id,
        username: session.user.name,
        role: session.user.role,
      },
    })
  } catch (error) {
    console.error("Token generation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

