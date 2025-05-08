import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"

export async function POST(request: Request) {
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

    const { taskIds, housekeeperId } = await request.json()

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ error: "Task IDs are required" }, { status: 400 })
    }

    if (!housekeeperId) {
      return NextResponse.json({ error: "Housekeeper ID is required" }, { status: 400 })
    }

    // Check if housekeeper exists
    const housekeeperCheck = await db.query("SELECT * FROM housekeepers WHERE id = $1 AND is_active = true", [
      housekeeperId,
    ])

    if (housekeeperCheck.rows.length === 0) {
      return NextResponse.json({ error: "Housekeeper not found or inactive" }, { status: 404 })
    }

    // Assign tasks to housekeeper
    const result = await db.query(
      `UPDATE tasks 
       SET assigned_to = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($2::int[])
       RETURNING *`,
      [housekeeperId, taskIds],
    )

    return NextResponse.json({
      success: true,
      tasksAssigned: result.rowCount,
      message: `${result.rowCount} tasks assigned successfully`,
    })
  } catch (error) {
    console.error("Error assigning tasks:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
