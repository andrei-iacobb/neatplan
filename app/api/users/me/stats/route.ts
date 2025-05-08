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

    // Get completed tasks count
    const completedTasksResult = await db.query(
      `SELECT COUNT(*) as count 
       FROM tasks 
       WHERE status = 'completed' 
       AND assigned_to IN (
         SELECT id FROM housekeepers WHERE user_id = $1
       )`,
      [authResult.user.userId],
    )
    const completedTasksCount = Number.parseInt(completedTasksResult.rows[0].count)

    // Get satisfaction rate (placeholder - in a real app, this would be calculated from ratings)
    const satisfactionRate = "95%"

    return NextResponse.json({
      completedTasksCount,
      satisfactionRate,
    })
  } catch (error) {
    console.error("Error fetching user stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
