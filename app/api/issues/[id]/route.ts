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

    // Get issue from database
    const result = await db.query(
      `SELECT i.*, t.title as task_title, u.username as reported_by_name
       FROM issues i
       LEFT JOIN tasks t ON i.task_id = t.id
       LEFT JOIN users u ON i.reported_by = u.id
       WHERE i.id = $1`,
      [id],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("Error fetching issue:", error)
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
    const { description, severity, is_resolved } = await request.json()

    let query = `
      UPDATE issues 
      SET description = $1, 
          severity = $2, 
          is_resolved = $3
    `

    const queryParams = [description, severity, is_resolved]

    // If resolving the issue, set resolved_at timestamp
    if (is_resolved) {
      query += `, resolved_at = CURRENT_TIMESTAMP`
    }

    query += `
      WHERE id = $4
      RETURNING *, 
      (SELECT title FROM tasks WHERE id = issues.task_id) as task_title,
      (SELECT username FROM users WHERE id = issues.reported_by) as reported_by_name
    `

    queryParams.push(id)

    // Update issue in database
    const result = await db.query(query, queryParams)

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Issue not found" }, { status: 404 })
    }

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("Error updating issue:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

