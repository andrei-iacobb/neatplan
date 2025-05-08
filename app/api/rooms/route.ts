import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions, isAdmin } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const building = searchParams.get("building")
    const floor = searchParams.get("floor")
    const status = searchParams.get("status")

    // Build where clause
    const where: any = {}
    if (building) where.building = building
    if (floor) where.floor = floor
    if (status) where.status = status

    // Fetch rooms with optional filters
    const rooms = await prisma.room.findMany({
      where,
      orderBy: {
        name: 'asc'
      },
      include: {
        tasks: {
          where: {
            status: 'pending'
          },
          select: {
            id: true,
            title: true,
            priority: true
          }
        }
      }
    })

    return NextResponse.json(rooms)
  } catch (error) {
    console.error("Error fetching rooms:", error)
    return NextResponse.json(
      { error: "Failed to fetch rooms" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    // Verify authentication and admin role
    const session = await getServerSession(authOptions)

    if (!session || !isAdmin(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, building, floor, status } = await request.json()

    // Validate required fields
    if (!name || !building || !floor || !status) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    // Check if room already exists
    const existingRoom = await prisma.room.findUnique({
      where: { name }
    })

    if (existingRoom) {
      return NextResponse.json(
        { error: "Room with this name already exists" },
        { status: 400 }
      )
    }

    // Create new room
    const room = await prisma.room.create({
      data: {
        name,
        building,
        floor,
        status
      }
    })

    return NextResponse.json(room)
  } catch (error) {
    console.error("Error creating room:", error)
    return NextResponse.json(
      { error: "Failed to create room" },
      { status: 500 }
    )
  }
}
