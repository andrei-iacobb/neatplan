import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get("is_active")

    // Build query based on filters
    let query = "SELECT * FROM housekeepers"
    const queryParams = []

    if (isActive !== null) {
      query += " WHERE is_active = $1"
      queryParams.push(isActive === "true")
    }

    query += " ORDER BY name ASC"

    // Get housekeepers from database
    const result = await db.query(query, queryParams)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error fetching housekeepers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, is_active } = await request.json()

    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    // Create new housekeeper
    const result = await db.query("INSERT INTO housekeepers (name, is_active) VALUES ($1, $2) RETURNING *", [
      name,
      is_active !== undefined ? is_active : true,
    ])

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("Error creating housekeeper:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

