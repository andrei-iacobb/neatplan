import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ScheduleStatus, Prisma } from '@prisma/client'
import { calculateNextDueDate } from '@/lib/schedule-utils'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; scheduleId: string }> }
) {
  try {
    const params = await context.params
    const { completedTasks } = await request.json()
    const now = new Date()

    // First get the current schedule to check its frequency
    const currentSchedule = await prisma.roomSchedule.findUnique({
      where: { id: params.scheduleId },
      include: {
        schedule: true // Include schedule details
      }
    })

    if (!currentSchedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // Calculate the next due date based on frequency
    const nextDue = calculateNextDueDate(currentSchedule.frequency as any, now)

    // Update everything in a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create completion log
      const log = await tx.roomScheduleCompletionLog.create({
        data: {
          roomScheduleId: params.scheduleId,
          completedAt: now,
          completedTasks: completedTasks as Prisma.InputJsonValue,
          notes: `Completed ${completedTasks.length} tasks for ${currentSchedule.schedule.title}`
        }
      })

      // Update the schedule with completion info and reset for next cycle
      const updated = await tx.roomSchedule.update({
        where: { id: params.scheduleId },
        data: {
          lastCompleted: now,
          nextDue: nextDue,
          status: ScheduleStatus.PENDING // Reset to pending for next cycle
        }
      })

      return { log, updated }
    })

    return NextResponse.json({
      completionLog: result.log,
      schedule: result.updated
    })
  } catch (error) {
    console.error('Error completing schedule:', error)
    return NextResponse.json(
      { error: 'Failed to complete schedule' },
      { status: 500 }
    )
  }
} 