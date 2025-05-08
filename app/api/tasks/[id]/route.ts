import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth/next"
import { authOptions, isAdmin } from "@/lib/auth"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const id = params.id

    // Get task from database with related information
    const result = await db.query(
      `SELECT t.*, r.room_number, r.floor, r.room_type, b.name as building_name,
       tt.name as template_name, u.username as assigned_to_name,
       u2.username as completed_by_name
       FROM tasks t
       JOIN rooms r ON t.room_id = r.id
       JOIN buildings b ON r.building_id = b.id
       LEFT JOIN task_templates tt ON t.template_id = tt.id
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN users u2 ON t.completed_by = u2.id
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
    // Verify authentication and admin role for full task updates
    const session = await getServerSession(authOptions)

    if (!session || !isAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const id = params.id
    const { name, description, priority, assigned_to, scheduled_for } = await request.json()

    // Build update query
    let query = "UPDATE tasks SET "
    const queryParams = []
    let paramIndex = 1

    if (name) {
      query += `name = $${paramIndex}, `
      queryParams.push(name)
      paramIndex++
    }

    if (description !== undefined) {
      query += `description = $${paramIndex}, `
      queryParams.push(description)
      paramIndex++
    }

    if (priority) {
      query += `priority = $${paramIndex}, `
      queryParams.push(priority)
      paramIndex++
    }

    if (assigned_to !== undefined) {
      query += `assigned_to = $${paramIndex}, `
      queryParams.push(assigned_to === null ? null : assigned_to)
      paramIndex++
    }

    if (scheduled_for) {
      query += `scheduled_for = $${paramIndex}, `
      queryParams.push(scheduled_for)
      paramIndex++
    }

    // Remove trailing comma and space
    query = query.slice(0, -2)

    // Add WHERE clause
    query += ` WHERE id = $${paramIndex} RETURNING *`
    queryParams.push(id)

    // Update task in database
    const result = await db.query(query, queryParams)

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // If task assignment changed, create a notification
    if (assigned_to !== undefined && assigned_to !== null) {
      // Get task and room details
      const taskResult = await db.query(
        `SELECT t.name, r.id as room_id, r.room_number 
         FROM tasks t
         JOIN rooms r ON t.room_id = r.id
         WHERE t.id = $1`,
        [id],
      )

      if (taskResult.rows.length > 0) {
        const { name, room_id, room_number } = taskResult.rows[0]

        // Create notification
        await db.query(
          `INSERT INTO notifications (user_id, title, message, room_id, priority) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            assigned_to,
            "Task Assignment",
            `You have been assigned to ${name} in Room ${room_number}.`,
            room_id,
            "normal",
          ],
        )
      }
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("Error updating task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    // Verify authentication and admin role
    const session = await getServerSession(authOptions)

    if (!session || !isAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const id = params.id

    // Delete task from database
    const result = await db.query("DELETE FROM tasks WHERE id = $1 RETURNING *", [id])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: "Task deleted successfully" })
  } catch (error) {
    console.error("Error deleting task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
