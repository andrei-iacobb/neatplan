import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth/next"
import { authOptions, getUserId, isAdmin } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = getUserId(session)

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const isRead = searchParams.get("is_read")
    const priority = searchParams.get("priority")

    // Build query based on filters
    let query = `
      SELECT n.*, r.room_number, r.floor, b.name as building_name
      FROM notifications n
      LEFT JOIN rooms r ON n.room_id = r.id
      LEFT JOIN buildings b ON r.building_id = b.id
      WHERE n.user_id = $1
    `

    const queryParams = [userId]
    let paramIndex = 2

    if (isRead !== null) {
      query += ` AND n.is_read = $${paramIndex}`
      queryParams.push(isRead === "true")
      paramIndex++
    }

    if (priority) {
      query += ` AND n.priority = $${paramIndex}`
      queryParams.push(priority)
      paramIndex++
    }

    query += " ORDER BY n.created_at DESC"

    // Get notifications from database
    const result = await db.query(query, queryParams)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error fetching notifications:", error)
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

    const { user_id, title, message, room_id, priority } = await request.json()

    // Validate required fields
    if (!user_id || !title || !message) {
      return NextResponse.json({ error: "User ID, title, and message are required" }, { status: 400 })
    }

    // Create new notification
    const result = await db.query(
      `INSERT INTO notifications (user_id, title, message, room_id, priority) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [user_id, title, message, room_id, priority || "normal"],
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("Error creating notification:", error)
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

    const { id, is_read } = await request.json()
    const userId = getUserId(session)

    // Validate required fields
    if (!id || is_read === undefined) {
      return NextResponse.json({ error: "Notification ID and read status are required" }, { status: 400 })
    }

    // Update notification in database
    const result = await db.query("UPDATE notifications SET is_read = $1 WHERE id = $2 AND user_id = $3 RETURNING *", [
      is_read,
      id,
      userId,
    ])

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Notification not found or not owned by user" }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("Error updating notification:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
