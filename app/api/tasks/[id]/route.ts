import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const id = params.id

    // Get task from database
    const result = await db.query(
      `SELECT t.*, h.name as assigned_to_name 
       FROM tasks t 
       LEFT JOIN housekeepers h ON t.assigned_to = h.id 
       WHERE t.id = $1`,
      [id],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("Error fetching task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const id = params.id
    const { title, description, status, assigned_to, scheduled_for } = await request.json()

    // Update task in database
    const result = await db.query(
      `UPDATE tasks 
       SET title = $1, 
           description = $2, 
           status = $3, 
           assigned_to = $4, 
           scheduled_for = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *, 
       (SELECT name FROM housekeepers WHERE id = $4) as assigned_to_name`,
      [title, description, status, assigned_to, scheduled_for, id],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("Error updating task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const id = params.id

    // Delete task from database
    const result = await db.query("DELETE FROM tasks WHERE id = $1 RETURNING *", [id])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

