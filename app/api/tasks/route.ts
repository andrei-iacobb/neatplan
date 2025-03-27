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
    const status = searchParams.get("status")

    let query
    const queryParams = []

    // If user is a housekeeper, only show their assigned tasks
    if (authResult.user.role === "housekeeper") {
      query = `
        SELECT t.*, h.name as assigned_to_name 
        FROM tasks t 
        LEFT JOIN housekeepers h ON t.assigned_to = h.id
        WHERE h.user_id = $1
      `
      queryParams.push(authResult.user.userId)

      if (status) {
        query += " AND t.status = $2"
        queryParams.push(status)
      }
    } else {
      // Admin can see all tasks
      query = `
        SELECT t.*, h.name as assigned_to_name 
        FROM tasks t 
        LEFT JOIN housekeepers h ON t.assigned_to = h.id
      `

      if (status) {
        query += " WHERE t.status = $1"
        queryParams.push(status)
      }
    }

    query += " ORDER BY t.scheduled_for ASC, t.created_at DESC"

    // Get tasks from database
    const result = await db.query(query, queryParams)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error fetching tasks:", error)
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

    const { taskId, status } = await request.json()

    // Validate required fields
    if (!taskId || !status) {
      return NextResponse.json({ error: "Task ID and status are required" }, { status: 400 })
    }

    // Check if user is authorized to update this task
    let canUpdate = false

    if (authResult.user.role === "admin") {
      canUpdate = true
    } else {
      // Check if task is assigned to this housekeeper
      const taskCheck = await db.query(
        `
        SELECT t.* FROM tasks t
        JOIN housekeepers h ON t.assigned_to = h.id
        WHERE t.id = $1 AND h.user_id = $2
      `,
        [taskId, authResult.user.userId],
      )

      canUpdate = taskCheck.rows.length > 0
    }

    if (!canUpdate) {
      return NextResponse.json({ error: "You are not authorized to update this task" }, { status: 403 })
    }

    // Update task status
    const result = await db.query(
      `UPDATE tasks 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, taskId],
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

