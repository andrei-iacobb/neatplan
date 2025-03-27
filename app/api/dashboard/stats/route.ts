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

    // Get staff count
    const staffResult = await db.query("SELECT COUNT(*) as count FROM housekeepers WHERE is_active = true")
    const staffCount = Number.parseInt(staffResult.rows[0].count)

    // Get active tasks count
    const activeTasksResult = await db.query("SELECT COUNT(*) as count FROM tasks WHERE status = 'in-progress'")
    const activeTasksCount = Number.parseInt(activeTasksResult.rows[0].count)

    // Get completed tasks count
    const completedTasksResult = await db.query("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'")
    const completedTasksCount = Number.parseInt(completedTasksResult.rows[0].count)

    // Get issues count
    const issuesResult = await db.query("SELECT COUNT(*) as count FROM issues WHERE is_resolved = false")
    const issuesCount = Number.parseInt(issuesResult.rows[0].count)

    // Get recent tasks
    const recentTasksResult = await db.query(
      `SELECT t.*, h.name as assigned_to_name 
       FROM tasks t 
       LEFT JOIN housekeepers h ON t.assigned_to = h.id 
       ORDER BY t.updated_at DESC 
       LIMIT 5`,
    )
    const recentTasks = recentTasksResult.rows

    // Get upcoming tasks
    const upcomingTasksResult = await db.query(
      `SELECT t.*, h.name as assigned_to_name 
       FROM tasks t 
       LEFT JOIN housekeepers h ON t.assigned_to = h.id 
       WHERE t.status = 'scheduled' AND t.scheduled_for > CURRENT_TIMESTAMP
       ORDER BY t.scheduled_for ASC 
       LIMIT 5`,
    )
    const upcomingTasks = upcomingTasksResult.rows

    // Get issues
    const issuesListResult = await db.query(
      `SELECT i.*, t.title as task_title 
       FROM issues i 
       LEFT JOIN tasks t ON i.task_id = t.id 
       WHERE i.is_resolved = false 
       ORDER BY i.created_at DESC 
       LIMIT 5`,
    )
    const issuesList = issuesListResult.rows

    return NextResponse.json({
      staffCount,
      activeTasksCount,
      completedTasksCount,
      issuesCount,
      recentTasks,
      upcomingTasks,
      issuesList,
    })
  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

