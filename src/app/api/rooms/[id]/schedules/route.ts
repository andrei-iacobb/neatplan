import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin, requireAuth, canAccessSite } from '@/lib/authz'
import { calculateNextDueDate } from '@/lib/schedule-utils'
import { Prisma } from '@/generated/prisma/client'

// POST /api/rooms/[id]/schedules - Assign a schedule to a room (admin only)
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const { scheduleId, frequency } = await request.json()
    const params = await context.params
    const roomId = params.id

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      )
    }

    // The room must belong to a site this user can access.
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { siteId: true }
    })

    if (!room || !canAccessSite(auth.user, room.siteId)) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    // Get the schedule to check for suggested frequency and its linked sites.
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: { sites: { select: { id: true } } }
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // A schedule can only be assigned to a room whose site it is linked to.
    if (!schedule.sites.some((s) => s.id === room.siteId)) {
      return NextResponse.json(
        { error: "This schedule is not available at this room's site" },
        { status: 400 }
      )
    }

    // Use provided frequency, or fall back to suggested frequency from AI detection
    const suggestedFrequency = (schedule as any).suggestedFrequency
    const assignedFrequency = frequency || suggestedFrequency

    if (!assignedFrequency) {
      return NextResponse.json(
        { error: 'Frequency is required. No frequency provided and schedule has no suggested frequency.' },
        { status: 400 }
      )
    }

    const nextDueDate = calculateNextDueDate(assignedFrequency)

    const roomSchedule = await prisma.roomSchedule.create({
      data: {
        roomId,
        scheduleId,
        frequency: assignedFrequency,
        nextDue: nextDueDate,
        status: 'PENDING'
      },
      include: {
        schedule: {
          select: {
            id: true,
            title: true,
            tasks: true
          }
        }
      }
    })

    return NextResponse.json(roomSchedule)
  } catch (error) {
    console.error('Error assigning schedule to room:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Schedule already assigned to this room' },
          { status: 409 }
        )
      }
      if (error.code === 'P2003') {
        return NextResponse.json(
          { error: 'Room or schedule not found' },
          { status: 404 }
        )
      }
    }
    return NextResponse.json(
      { error: 'Failed to assign schedule to room' },
      { status: 500 }
    )
  }
}

// GET /api/rooms/[id]/schedules - Get all schedules for a room (any authenticated user)
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error

    const params = await context.params
    const roomId = params.id

    // The room must belong to a site this user can access.
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { siteId: true }
    })

    if (!room || !canAccessSite(auth.user, room.siteId)) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    const roomSchedules = await prisma.roomSchedule.findMany({
      where: {
        roomId
      },
      include: {
        schedule: {
          select: {
            id: true,
            title: true,
            tasks: true
          }
        }
      }
    })

    return NextResponse.json(roomSchedules)
  } catch (error) {
    console.error('Error fetching room schedules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch room schedules' },
      { status: 500 }
    )
  }
}

// The former PATCH handler that lived here responded to `/api/rooms/[id]/schedules`
// (with no [scheduleId] segment), so it could never resolve a specific schedule and
// always 404'd. The working, admin-guarded completion handler now lives at
// `/api/rooms/[id]/schedules/[scheduleId]/route.ts`.
