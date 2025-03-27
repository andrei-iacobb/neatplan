import { NextResponse } from "next/server"
import bcrypt from "bcrypt"
import { db } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    // Check if username already exists
    const existingUser = await db.query("SELECT * FROM users WHERE username = $1", [username])

    if (existingUser.rows.length > 0) {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create new user
    const result = await db.query("INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username", [
      username,
      hashedPassword,
    ])

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

