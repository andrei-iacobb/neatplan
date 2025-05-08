import { NextResponse } from "next/server"
import { cleaningSheetService } from "@/lib/cleaning-sheets"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      )
    }

    // Analyze the cleaning sheet
    const roomTypes = await cleaningSheetService.analyzeCleaningSheet(file)

    // Create task lists for each room type
    const taskLists = await Promise.all(
      roomTypes.map((roomType) => cleaningSheetService.createTaskList(roomType))
    )

    return NextResponse.json({
      success: true,
      taskLists,
    })
  } catch (error) {
    console.error("Error processing cleaning sheet:", error)
    return NextResponse.json(
      { error: "Failed to process cleaning sheet" },
      { status: 500 }
    )
  }
} 