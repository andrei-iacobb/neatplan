import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ScheduleStatus } from '@prisma/client'
import { calculateNextDueDate } from '@/lib/schedule-utils'

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  const params = await context.params
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only cleaners should access this endpoint
    if (session.user.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin users should use the admin interface' },
        { status: 403 }
      )
    }

    const { roomId } = params
    const body = await request.json()
    const { scheduleId, completedTasks, notes, duration } = body

    // Validate required fields
    if (!scheduleId || !completedTasks || !Array.isArray(completedTasks)) {
      return NextResponse.json(
        { error: 'Missing required fields: scheduleId, completedTasks' },
        { status: 400 }
      )
    }

    if (completedTasks.length === 0) {
      return NextResponse.json(
        { error: 'At least one task must be completed' },
        { status: 400 }
      )
    }

    // Get the room schedule
    const roomSchedule = await prisma.roomSchedule.findUnique({
      where: {
        id: scheduleId
      },
      include: {
        schedule: {
          include: {
            tasks: true
          }
        }
      }
    })

    if (!roomSchedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    if (roomSchedule.roomId !== roomId) {
      return NextResponse.json(
        { error: 'Schedule does not belong to this room' },
        { status: 400 }
      )
    }

    // Calculate next due date based on frequency
    const now = new Date()
    const nextDue = calculateNextDueDate(roomSchedule.frequency as any, now)

    // Complete inside a transaction, guarding against double submits (double-tap on a
    // tablet, network retry): only one concurrent completion advances the cycle. The
    // optimistic match on lastCompleted means the loser writes nothing and is reported
    // as an idempotent duplicate instead of creating a second log / skipping a cycle.
    const result = await prisma.$transaction(async (tx) => {
      const advanced = await tx.roomSchedule.updateMany({
        where: { id: scheduleId, lastCompleted: roomSchedule.lastCompleted },
        data: {
          status: ScheduleStatus.PENDING,
          lastCompleted: now,
          nextDue,
        },
      })

      if (advanced.count === 0) {
        return { duplicate: true as const }
      }

      const completionLog = await tx.roomScheduleCompletionLog.create({
        data: {
          roomScheduleId: scheduleId,
          completedTasks: completedTasks as any,
          notes: notes || null,
          completedAt: now,
          completedByUserId: session.user.id,
        },
      })

      return { completionLog }
    })

    if ('duplicate' in result) {
      return NextResponse.json(
        { error: 'This schedule was just completed', duplicate: true },
        { status: 409 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule completed successfully',
      completionId: result.completionLog.id,
      nextDue: nextDue.toISOString(),
      data: {
        completedTasks: completedTasks.length,
        duration: duration || null,
        scheduleId
      }
    })

  } catch (error) {
    console.error('Error completing schedule:', error)
    return NextResponse.json(
      { error: 'Failed to complete schedule' },
      { status: 500 }
    )
  }
}

// unified calculateNextDueDate is used from lib