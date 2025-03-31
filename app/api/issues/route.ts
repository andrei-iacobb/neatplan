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
    const isResolved = searchParams.get("is_resolved")

    // Build query based on filters
    let query = `
      SELECT i.*, t.title as task_title, u.username as reported_by_name
      FROM issues i
      LEFT JOIN tasks t ON i.task_id = t.id
      LEFT JOIN users u ON i.reported_by = u.id
    `
    const queryParams = []

    if (isResolved !== null) {
      query += " WHERE i.is_resolved = $1"
      queryParams.push(isResolved === "true")
    }

    query += " ORDER BY i.created_at DESC"

    // Get issues from database
    const result = await db.query(query, queryParams)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error fetching issues:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request)
    if (!authResult.isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { task_id, description, severity, reported_by } = await request.json()

    // Validate required fields
    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 })
    }

    // Create new issue
    const result = await db.query(
      `INSERT INTO issues (task_id, description, severity, reported_by) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *, 
       (SELECT title FROM tasks WHERE id = $1) as task_title,
       (SELECT username FROM users WHERE id = $4) as reported_by_name`,
      [task_id, description, severity || "medium", reported_by],
    )

    return NextResponse.json(result.rows[0])
  } catch (error) {
    console.error("Error creating issue:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

