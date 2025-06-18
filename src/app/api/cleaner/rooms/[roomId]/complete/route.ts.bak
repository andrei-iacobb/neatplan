import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'
import { ScheduleFrequency, ScheduleStatus } from '@prisma/client'

export async function POST(
  request: Request,
  { params }: { params: { roomId: string } }
) {
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
    const nextDue = calculateNextDueDate(roomSchedule.frequency)

    // Start a transaction to update schedule and create completion log
    const result = await prisma.$transaction(async (tx) => {
      // Create completion log
      const completionLog = await tx.roomScheduleCompletionLog.create({
        data: {
          roomScheduleId: scheduleId,
          completedTasks: completedTasks as any,
          notes: notes || null,
          completedAt: new Date()
        }
      })

      // Update the existing room schedule for the next cleaning cycle
      const updatedSchedule = await tx.roomSchedule.update({
        where: {
          id: scheduleId
        },
        data: {
          status: ScheduleStatus.COMPLETED, // Mark as completed, not pending
          lastCompleted: new Date(),
          nextDue: nextDue
        }
      })

      return {
        completionLog,
        updatedSchedule
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Schedule completed successfully',
      completionId: result.completionLog.id,
      nextDue: result.updatedSchedule.nextDue.toISOString(),
      data: {
        completedTasks: completedTasks.length,
        duration: duration || null,
        scheduleId: result.updatedSchedule.id
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

function calculateNextDueDate(frequency: ScheduleFrequency): Date {
  const now = new Date()
  const nextDue = new Date(now)

  switch (frequency) {
    case ScheduleFrequency.DAILY:
      nextDue.setDate(now.getDate() + 1)
      break
    case ScheduleFrequency.WEEKLY:
      nextDue.setDate(now.getDate() + 7)
      break
    case ScheduleFrequency.BIWEEKLY:
      nextDue.setDate(now.getDate() + 14)
      break
    case ScheduleFrequency.MONTHLY:
      nextDue.setMonth(now.getMonth() + 1)
      break
    case ScheduleFrequency.QUARTERLY:
      nextDue.setMonth(now.getMonth() + 3)
      break
    case ScheduleFrequency.YEARLY:
      nextDue.setFullYear(now.getFullYear() + 1)
      break
    case ScheduleFrequency.CUSTOM:
      // For custom frequency, default to weekly
      nextDue.setDate(now.getDate() + 7)
      break
    default:
      // Default to daily if frequency is not recognized
      nextDue.setDate(now.getDate() + 1)
      break
  }

  return nextDue
} 