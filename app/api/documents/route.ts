import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth/next"
import { authOptions, isAdmin, getUserId } from "@/lib/auth"
import { writeFile } from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"

// This would be replaced with your actual AI processing function
async function processDocumentWithAI(filePath: string) {
  // Simulate AI processing delay
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // In a real implementation, this would call an AI service to extract tasks from the document
  // For demo purposes, we'll return mock data in the expected format
  return {
    building: "Demo Hotel",
    rooms: [
      {
        room_number: "101",
        tasks: [
          { name: "Make Bed", priority: 1 },
          { name: "Clean Bathroom", priority: 1 },
          { name: "Vacuum Floor", priority: 2 },
        ],
      },
      {
        room_number: "102",
        tasks: [
          { name: "Make Bed", priority: 1 },
          { name: "Clean Bathroom", priority: 1 },
          { name: "Dust Surfaces", priority: 2 },
        ],
      },
      {
        room_number: "201",
        tasks: [
          { name: "Make Bed", priority: 1 },
          { name: "Clean Bathroom", priority: 1 },
          { name: "Empty Trash", priority: 3 },
        ],
      },
    ],
  }
}

export async function POST(request: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Process form data with file
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    // Check file type
    if (!file.type.includes("image/") && !file.type.includes("application/pdf")) {
      return NextResponse.json({ error: "Invalid file type. Please upload an image or PDF." }, { status: 400 })
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "uploads")
    try {
      await writeFile(path.join(uploadsDir, ".gitkeep"), "")
    } catch (error) {
      // Directory already exists or cannot be created
    }

    // Generate unique filename
    const uniqueFilename = `${uuidv4()}${path.extname(file.name)}`
    const filePath = path.join(uploadsDir, uniqueFilename)

    // Save file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Save document record to database
    const documentResult = await db.query(
      "INSERT INTO cleaning_sheets (file_path, uploaded_by) VALUES ($1, $2) RETURNING id",
      [uniqueFilename, getUserId(session)],
    )

    const documentId = documentResult.rows[0].id

    // Process document with AI (this would be a background job in production)
    const extractedData = await processDocumentWithAI(filePath)

    // Get building ID
    const buildingResult = await db.query("SELECT id FROM buildings WHERE name = $1", [extractedData.building])

    let buildingId
    if (buildingResult.rows.length > 0) {
      buildingId = buildingResult.rows[0].id
    } else {
      // Create new building if not found
      const newBuildingResult = await db.query("INSERT INTO buildings (name) VALUES ($1) RETURNING id", [
        extractedData.building,
      ])
      buildingId = newBuildingResult.rows[0].id
    }

    // Process each room and its tasks
    let totalTasksCreated = 0

    for (const roomData of extractedData.rooms) {
      // Check if room exists
      const roomResult = await db.query("SELECT id FROM rooms WHERE building_id = $1 AND room_number = $2", [
        buildingId,
        roomData.room_number,
      ])

      let roomId
      if (roomResult.rows.length > 0) {
        roomId = roomResult.rows[0].id

        // Update room status to 'dirty' to indicate it needs cleaning
        await db.query("UPDATE rooms SET status = 'dirty' WHERE id = $1", [roomId])
      } else {
        // Create new room if not found
        const newRoomResult = await db.query(
          "INSERT INTO rooms (building_id, room_number, status) VALUES ($1, $2, 'dirty') RETURNING id",
          [buildingId, roomData.room_number],
        )
        roomId = newRoomResult.rows[0].id
      }

      // Create tasks for this room
      for (const taskData of roomData.tasks) {
        // Check if there's a matching template
        const templateResult = await db.query("SELECT id FROM task_templates WHERE name ILIKE $1", [
          `%${taskData.name}%`,
        ])

        const templateId = templateResult.rows.length > 0 ? templateResult.rows[0].id : null

        // Schedule for tomorrow
        const scheduledTime = new Date()
        scheduledTime.setDate(scheduledTime.getDate() + 1)

        // Create the task
        await db.query(
          `INSERT INTO tasks (room_id, template_id, name, description, priority, scheduled_for) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            roomId,
            templateId,
            taskData.name,
            `${taskData.name} for Room ${roomData.room_number}`,
            taskData.priority || 1,
            scheduledTime,
          ],
        )

        totalTasksCreated++
      }
    }

    // Update document status
    await db.query("UPDATE cleaning_sheets SET status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE id = $1", [
      documentId,
    ])

    return NextResponse.json({
      success: true,
      documentId,
      message: "Document uploaded and processed successfully",
      tasksCreated: totalTasksCreated,
      roomsProcessed: extractedData.rooms.length,
    })
  } catch (error) {
    console.error("Document upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can view all documents
    if (!isAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Get all documents
    const result = await db.query(`
      SELECT cs.*, u.username as uploaded_by_name
      FROM cleaning_sheets cs
      JOIN users u ON cs.uploaded_by = u.id
      ORDER BY cs.created_at DESC
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error fetching documents:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
