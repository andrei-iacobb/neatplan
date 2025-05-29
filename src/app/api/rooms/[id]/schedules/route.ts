import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateNextDueDate } from '@/lib/schedule-utils'
import { Prisma } from '@prisma/client'

// POST /api/rooms/[id]/schedules - Assign a schedule to a room
export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const { scheduleId, frequency } = await request.json()
    const params = await context.params
    const roomId = params.id

    if (!scheduleId || !frequency) {
      return NextResponse.json(
        { error: 'Schedule ID and frequency are required' },
        { status: 400 }
      )
    }

    // Check if the schedule is already assigned to the room
    const existingSchedule = await prisma.roomSchedule.findUnique({
      where: {
        roomId_scheduleId: {
          roomId,
          scheduleId
        }
      }
    })

    if (existingSchedule) {
      return NextResponse.json(
        { error: 'This schedule is already assigned to this room' },
        { status: 400 }
      )
    }

    const nextDueDate = calculateNextDueDate(frequency)

    const roomSchedule = await prisma.roomSchedule.create({
      data: {
        roomId,
        scheduleId,
        frequency,
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
    return NextResponse.json(
      { error: 'Failed to assign schedule to room' },
      { status: 500 }
    )
  }
}

// GET /api/rooms/[id]/schedules - Get all schedules for a room
export async function GET(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params
    const roomId = params.id

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

// PATCH /api/rooms/[id]/schedules/[scheduleId] - Mark a room schedule as completed
export async function PATCH(
  request: Request,
  context: { params: { id: string; scheduleId: string } }
) {
  try {
    const { notes } = await request.json()
    const params = await context.params
    const { id: roomId, scheduleId } = params
    const now = new Date()

    // Find the room schedule
    const roomSchedule = await prisma.roomSchedule.findUnique({
      where: {
        roomId_scheduleId: {
          roomId,
          scheduleId
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
            roomId,
            scheduleId
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
  } catch (error) {
    console.error('Error completing room schedule:', error)
    return NextResponse.json(
      { error: 'Failed to complete schedule' },
      { status: 500 }
    )
  }
} 