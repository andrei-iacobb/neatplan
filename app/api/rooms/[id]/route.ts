import { NextResponse } from "next/server"
import { prisma } from "../../../../lib/db"
import { getServerSession } from "next-auth/next"
import { authOptions, isAdmin } from "@/lib/auth"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const id = params.id

    // Get room from database with tasks
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        tasks: {
          include: {
            user: {
              select: {
                username: true
              }
            }
          },
          orderBy: [
            { priority: 'asc' },
            { dueDate: 'asc' }
          ]
        },
        building: true,
        cleaning_sheets: {
          orderBy: {
            created_at: "desc"
          },
          take: 1
        }
      }
    })

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    // Transform the data to match the expected format
    const formattedRoom = {
      ...room,
      tasks: room.tasks.map(task => ({
        ...task,
        assigned_to_name: task.user?.username
      }))
    }

    return NextResponse.json(formattedRoom)
  } catch (error) {
    console.error("Error fetching room:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    // Verify authentication and admin role
    const session = await getServerSession(authOptions)

    if (!session || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const id = params.id
    const { status } = await request.json()

    // Update room status
    const updatedRoom = await prisma.room.update({
      where: { id },
      data: { 
        status,
        lastCleaned: status === "clean" ? new Date() : undefined
      }
    })

    return NextResponse.json(updatedRoom)
  } catch (error) {
    console.error("Error updating room:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    // Verify authentication and admin role
    const session = await getServerSession(authOptions)

    if (!session || !isAdmin(session.user)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const id = params.id

    // First, delete all cleaning sheets associated with the room
    await prisma.cleaningSheet.deleteMany({
      where: {
        room_id: parseInt(id)
      }
    })

    // Delete tasks associated with this room first
    await prisma.task.deleteMany({
      where: { roomId: id }
    })

    // Delete documents associated with this room
    await prisma.document.deleteMany({
      where: { roomId: id }
    })

    // Delete room from database
    const result = await prisma.room.delete({
      where: { id }
    })

    if (!result) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    return NextResponse.json({ message: "Room deleted successfully" })
  } catch (error) {
    console.error("Error deleting room:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
