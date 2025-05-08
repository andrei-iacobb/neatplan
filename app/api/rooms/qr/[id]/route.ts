import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const qrCodeId = params.id

    // Get room from database with building name
    const result = await db.query(
      `SELECT r.*, b.name as building_name
       FROM rooms r
       JOIN buildings b ON r.building_id = b.id
       WHERE r.qr_code_id = $1`,
      [qrCodeId],
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Get tasks for this room
    const tasksResult = await db.query(
      `SELECT t.*, tt.name as template_name, u.username as assigned_to_name
       FROM tasks t
       LEFT JOIN task_templates tt ON t.template_id = tt.id
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.room_id = $1
       ORDER BY t.priority ASC, t.scheduled_for ASC`,
      [result.rows[0].id],
    )

    const room = result.rows[0]
    room.tasks = tasksResult.rows

    return NextResponse.json(room)
  } catch (error) {
    console.error("Error fetching room by QR code:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
