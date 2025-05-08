import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth/next"
import { authOptions, isAdmin, getUserId } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get("room_id")
    const status = searchParams.get("status")
    const assignedTo = searchParams.get("assigned_to")

    // Build query based on filters
    let query = `
      SELECT t.*, r.room_number, r.floor, r.room_type, b.name as building_name,
      tt.name as template_name, u.username as assigned_to_name
      FROM tasks t
      JOIN rooms r ON t.room_id = r.id
      JOIN buildings b ON r.building_id = b.id
      LEFT JOIN task_templates tt ON t.template_id = tt.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE 1=1
    `

    const queryParams = []
    let paramIndex = 1

    // If user is not admin, only show tasks assigned to them
    if (!isAdmin(session)) {
      query += ` AND t.assigned_to = $${paramIndex}`
      queryParams.push(getUserId(session))
      paramIndex++
    } else if (assignedTo) {
      // Admin can filter by assigned_to
      query += ` AND t.assigned_to = $${paramIndex}`
      queryParams.push(assignedTo)
      paramIndex++
    }

    if (roomId) {
      query += ` AND t.room_id = $${paramIndex}`
      queryParams.push(roomId)
      paramIndex++
    }

    if (status) {
      query += ` AND t.status = $${paramIndex}`
      queryParams.push(status)
      paramIndex++
    }

    query += " ORDER BY t.priority ASC, t.scheduled_for ASC"

    // Get tasks from database
    const result = await db.query(query, queryParams)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error fetching tasks:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Verify authentication and admin role
    const session = await getServerSession(authOptions)

    if (!session || !isAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { room_id, template_id, name, description, priority, assigned_to, scheduled_for } = await request.json()

    // Validate required fields
    if (!room_id || !name) {
      return NextResponse.json({ error: "Room ID and task name are required" }, { status: 400 })
    }

    // Create new task
    const result = await db.query(
      `INSERT INTO tasks (room_id, template_id, name, description, priority, assigned_to, scheduled_for) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [room_id, template_id, name, description, priority || 1, assigned_to, scheduled_for],
    )

    // If task is assigned to someone, create a notification
    if (assigned_to) {
      // Get room details
      const roomResult = await db.query("SELECT room_number FROM rooms WHERE id = $1", [room_id])

      if (roomResult.rows.length > 0) {
        const roomNumber = roomResult.rows[0].room_number

        // Create notification
        await db.query(
          `INSERT INTO notifications (user_id, title, message, room_id, priority) 
           VALUES ($1, $2, $3, $4, $5)`,
          [
            assigned_to,
            "New Task Assignment",
            `You have been assigned to ${name} in Room ${roomNumber}.`,
            room_id,
            "normal",
          ],
        )
      }
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("Error creating task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, status, completed_by } = await request.json()

    // Validate required fields
    if (!id || !status) {
      return NextResponse.json({ error: "Task ID and status are required" }, { status: 400 })
    }

    // Check if user is authorized to update this task
    let canUpdate = false
    let taskAssignedTo = null

    if (isAdmin(session)) {
      canUpdate = true
    } else {
      // Check if task is assigned to this user
      const taskCheck = await db.query("SELECT assigned_to FROM tasks WHERE id = $1", [id])

      if (taskCheck.rows.length > 0) {
        taskAssignedTo = taskCheck.rows[0].assigned_to
        canUpdate = taskAssignedTo === Number.parseInt(getUserId(session))
      }
    }

    if (!canUpdate) {
      return NextResponse.json({ error: "Unauthorized to update this task" }, { status: 403 })
    }

    // Build update query
    let query = "UPDATE tasks SET status = $1"
    const queryParams = [status]
    let paramIndex = 2

    // If status is 'completed', set completed_at and completed_by
    if (status === "completed") {
      query += ", completed_at = CURRENT_TIMESTAMP"

      // Use the provided completed_by or the current user
      const completedById = completed_by || getUserId(session)
      query += `, completed_by = $${paramIndex}`
      queryParams.push(completedById)
      paramIndex++
    }

    // Add WHERE clause
    query += ` WHERE id = $${paramIndex} RETURNING *`
    queryParams.push(id)

    // Update task in database
    const result = await db.query(query, queryParams)

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // If task is completed, check if all tasks for this room are completed
    if (status === "completed") {
      const roomId = result.rows[0].room_id

      // Count remaining pending tasks for this room
      const pendingTasksResult = await db.query(
        "SELECT COUNT(*) FROM tasks WHERE room_id = $1 AND status != 'completed'",
        [roomId],
      )

      const pendingTasksCount = Number.parseInt(pendingTasksResult.rows[0].count)

      // If no pending tasks, update room status to clean
      if (pendingTasksCount === 0) {
        await db.query("UPDATE rooms SET status = 'clean', last_cleaned = CURRENT_TIMESTAMP WHERE id = $1", [roomId])
      }
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("Error updating task:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
