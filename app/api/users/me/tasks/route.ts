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

    // Get user's assigned tasks
    let query = `
      SELECT t.*, h.name as assigned_to_name 
      FROM tasks t 
      LEFT JOIN housekeepers h ON t.assigned_to = h.id 
      WHERE h.id IN (
        SELECT id FROM housekeepers WHERE user_id = $1
      )
    `

    const queryParams = [authResult.user.userId]

    if (status) {
      query += " AND t.status = $2"
      queryParams.push(status)
    }

    query += " ORDER BY t.updated_at DESC"

    const result = await db.query(query, queryParams)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error fetching user tasks:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
