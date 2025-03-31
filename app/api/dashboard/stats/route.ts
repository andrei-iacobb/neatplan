import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth/next"
import { authOptions, isAdmin } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    // Verify authentication using NextAuth
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is admin
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get total housekeepers
    const housekeepersResult = await db.query("SELECT COUNT(*) as count FROM housekeepers WHERE is_active = true")
    const activeHousekeepers = Number.parseInt(housekeepersResult.rows[0].count)

    // Get task statistics
    const taskStatsResult = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
        COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress_tasks,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
        COUNT(*) FILTER (WHERE assigned_to IS NULL) as unassigned_tasks
      FROM tasks
    `)

    // Get recent documents
    const recentDocumentsResult = await db.query(`
      SELECT d.*, u.username as uploaded_by_name, 
      (SELECT COUNT(*) FROM tasks WHERE document_id = d.id) as task_count
      FROM scanned_documents d
      JOIN users u ON d.uploaded_by = u.id
      ORDER BY d.created_at DESC
      LIMIT 5
    `)

    // Get housekeeper performance
    const performanceResult = await db.query(`
      SELECT h.id, h.name, 
        COUNT(*) FILTER (WHERE t.status = 'completed') as completed_tasks,
        COUNT(*) FILTER (WHERE t.status = 'pending' OR t.status = 'in-progress') as pending_tasks,
        ROUND(
          COUNT(*) FILTER (WHERE t.status = 'completed')::numeric / 
          NULLIF(COUNT(*), 0)::numeric * 100
        ) as completion_rate
      FROM housekeepers h
      LEFT JOIN tasks t ON h.id = t.assigned_to
      WHERE h.is_active = true
      GROUP BY h.id, h.name
      ORDER BY completion_rate DESC NULLS LAST
      LIMIT 5
    `)

    return NextResponse.json({
      activeHousekeepers,
      taskStats: taskStatsResult.rows[0],
      recentDocuments: recentDocumentsResult.rows,
      housekeeperPerformance: performanceResult.rows,
    })
  } catch (error) {
    console.error("Error fetching admin dashboard data:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

