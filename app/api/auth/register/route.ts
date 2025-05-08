import { NextResponse } from "next/server"
import { pool } from "@/lib/db"
import bcrypt from "bcrypt"
import { z } from "zod"

const registerSchema = z.object({
  username: z.string().min(3).max(100),
  password: z.string().min(6),
  role: z.enum(["admin", "cleaner"]).default("cleaner"),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { username, password, role } = registerSchema.parse(body)

    // Check if user already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username]
    )

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const result = await pool.query(
      "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role",
      [username, hashedPassword, role]
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("Registration error:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
