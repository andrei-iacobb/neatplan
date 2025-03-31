import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { apiAuthMiddleware, unauthorizedResponse, forbiddenResponse } from "@/lib/api-middleware"
import { writeFile } from "fs/promises"
import path from "path"
import { v4 as uuidv4 } from "uuid"

// This would be replaced with your actual AI processing function
async function processDocumentWithAI(filePath: string) {
  // Simulate AI processing delay
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Return mock tasks extracted from the document
  return [
    {
      title: "Clean Room 101",
      location: "First Floor",
      description: "Standard cleaning protocol",
      scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    },
    {
      title: "Restock Supplies",
      location: "Storage Room",
      description: "Restock cleaning supplies in all carts",
      scheduled_for: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
    },
  ]
}

export async function POST(request: Request) {
  try {
    // Verify authentication
    const authResult = await apiAuthMiddleware(request)
    if (!authResult.isAuthenticated) {
      return unauthorizedResponse()
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
      "INSERT INTO scanned_documents (file_path, uploaded_by) VALUES ($1, $2) RETURNING id",
      [uniqueFilename, authResult.user.userId],
    )

    const documentId = documentResult.rows[0].id

    // Process document with AI (this would be a background job in production)
    const extractedTasks = await processDocumentWithAI(filePath)

    // Save extracted tasks to database
    for (const task of extractedTasks) {
      await db.query(
        `INSERT INTO tasks 
         (document_id, title, location, description, scheduled_for) 
         VALUES ($1, $2, $3, $4, $5)`,
        [documentId, task.title, task.location, task.description, task.scheduled_for],
      )
    }

    // Update document status
    await db.query(
      "UPDATE scanned_documents SET status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE id = $1",
      [documentId],
    )

    return NextResponse.json({
      success: true,
      documentId,
      message: "Document uploaded and processed successfully",
      tasksExtracted: extractedTasks.length,
    })
  } catch (error) {
    console.error("Document upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    // Verify authentication
    const authResult = await apiAuthMiddleware(request)
    if (!authResult.isAuthenticated) {
      return unauthorizedResponse()
    }

    // Check if user is admin
    if (authResult.user.role !== "admin") {
      return forbiddenResponse()
    }

    // Get all documents
    const result = await db.query(`
      SELECT d.*, u.username as uploaded_by_name, 
      (SELECT COUNT(*) FROM tasks WHERE document_id = d.id) as task_count
      FROM scanned_documents d
      JOIN users u ON d.uploaded_by = u.id
      ORDER BY d.created_at DESC
    `)

    return NextResponse.json(result.rows)
  } catch (error) {
    console.error("Error fetching documents:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

