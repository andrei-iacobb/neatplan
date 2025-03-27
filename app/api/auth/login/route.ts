import { NextResponse } from "next/server"
import { sign } from "jsonwebtoken"
import { db } from "@/lib/db"
import bcrypt from "bcrypt"

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    // Find user in database
    const user = await db.query("SELECT * FROM users WHERE username = $1", [username])

    if (user.rows.length === 0) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.rows[0].password)

    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Generate JWT token
    const token = sign(
      {
        userId: user.rows[0].id,
        username: user.rows[0].username,
        role: user.rows[0].role,
      },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "7d" },
    )

    return NextResponse.json({
      access_token: token,
      user: {
        id: user.rows[0].id,
        username: user.rows[0].username,
        role: user.rows[0].role,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

