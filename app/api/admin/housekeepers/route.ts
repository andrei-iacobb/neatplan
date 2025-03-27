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

    // Check if user is admin
    if (authResult.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all housekeepers
    const result = await db.query(`
      SELECT h.*, u.username, 
      (SELECT COUNT(*) FROM tasks WHERE assigned_to = h.id AND status = 'pending') as pending_tasks,
      (SELECT COUNT(*) FROM tasks WHERE assigned_to = h.id AND status = 'completed') as completed_tasks
      FROM housekeepers h
      JOIN users u ON h.user_id = u.id
      ORDER BY h.name ASC
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error fetching housekeepers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    if (authResult.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id, name, is_active } = await request.json()

    // Update housekeeper
    const result = await db.query("UPDATE housekeepers SET name = $1, is_active = $2 WHERE id = $3 RETURNING *", [
      name,
      is_active,
      id,
    ])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Housekeeper not found" }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("Error updating housekeeper:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

