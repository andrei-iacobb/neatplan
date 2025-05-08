import { NextResponse } from "next/server"
import { sign } from "jsonwebtoken"
import { db } from "@/lib/db"
import bcrypt from "bcrypt"

// This endpoint is for mobile app authentication
// It returns a JWT token that can be used with the API
export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    // Find user in database
    const result = await db.query("SELECT * FROM users WHERE username = $1", [username])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const user = result.rows[0]

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Generate JWT token for mobile app
    const token = sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
      },
      process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "default_secret",
      { expiresIn: "7d" },
    )

    return NextResponse.json({
      access_token: token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    })
  } catch (error) {
    console.error("Token generation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
