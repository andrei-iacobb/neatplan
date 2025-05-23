import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateNextDueDate } from '@/lib/schedule-utils'
import { ScheduleFrequency } from '@/types/schedule'

// POST /api/rooms/[id]/schedules - Assign a schedule to a room
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { scheduleId, frequency } = await req.json()

    if (!scheduleId || !frequency) {
      return NextResponse.json(
        { error: 'Schedule ID and frequency are required' },
        { status: 400 }
      )
    }

    // Calculate the next due date based on frequency
    const nextDue = calculateNextDueDate(frequency as ScheduleFrequency)

    // Create the room schedule assignment
    const roomSchedule = await prisma.roomSchedule.create({
      data: {
        roomId: params.id,
        scheduleId,
        frequency: frequency as ScheduleFrequency,
        nextDue,
      },
      include: {
        room: true,
        schedule: {
          include: {
            tasks: true
          }
        }
      }
    })

    return NextResponse.json(roomSchedule)
  } catch (error: any) {
    console.error('Error assigning schedule to room:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to assign schedule' },
      { status: 500 }
    )
  }
}

// GET /api/rooms/[id]/schedules - Get all schedules assigned to a room
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const roomSchedules = await prisma.roomSchedule.findMany({
      where: {
        roomId: params.id
      },
      include: {
        schedule: {
          include: {
            tasks: true
          }
        }
      },
      orderBy: {
        nextDue: 'asc'
      }
    })

    return NextResponse.json(roomSchedules)
  } catch (error: any) {
    console.error('Error fetching room schedules:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch schedules' },
      { status: 500 }
    )
  }
}

// PATCH /api/rooms/[id]/schedules/[scheduleId] - Mark a room schedule as completed
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; scheduleId: string } }
) {
  try {
    const { notes } = await req.json()
    const now = new Date()

    // Find the room schedule
    const roomSchedule = await prisma.roomSchedule.findUnique({
      where: {
        roomId_scheduleId: {
          roomId: params.id,
          scheduleId: params.scheduleId
        }
      }
    })

    if (!roomSchedule) {
      return NextResponse.json(
        { error: 'Room schedule not found' },
        { status: 404 }
      )
    }

    // Calculate the next due date based on frequency
    const nextDue = calculateNextDueDate(roomSchedule.frequency, now)

    // Update the room schedule and create a completion log
    const [updated] = await prisma.$transaction([
      prisma.roomSchedule.update({
        where: {
          roomId_scheduleId: {
            roomId: params.id,
            scheduleId: params.scheduleId
          }
        },
        data: {
          lastCompleted: now,
          nextDue,
          status: 'COMPLETED',
          completionLogs: {
            create: {
              notes,
              completedAt: now
            }
          }
        },
        include: {
          room: true,
          schedule: {
            include: {
              tasks: true
            }
          }
        }
      })
    ])

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error completing room schedule:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to complete schedule' },
      { status: 500 }
    )
  }
} 