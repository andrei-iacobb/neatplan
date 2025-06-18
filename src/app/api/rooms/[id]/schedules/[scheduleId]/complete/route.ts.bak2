import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ScheduleStatus, ScheduleFrequency, Prisma } from '@prisma/client'

function calculateNextDueDate(frequency: ScheduleFrequency, lastCompleted: Date): Date {
  const nextDue = new Date(lastCompleted)
  
  switch (frequency) {
    case ScheduleFrequency.DAILY:
      nextDue.setDate(nextDue.getDate() + 1)
      break
    case ScheduleFrequency.WEEKLY:
      nextDue.setDate(nextDue.getDate() + 7)
      break
    case ScheduleFrequency.BIWEEKLY:
      nextDue.setDate(nextDue.getDate() + 14)
      break
    case ScheduleFrequency.MONTHLY:
      nextDue.setMonth(nextDue.getMonth() + 1)
      break
    case ScheduleFrequency.QUARTERLY:
      nextDue.setMonth(nextDue.getMonth() + 3)
      break
    case ScheduleFrequency.YEARLY:
      nextDue.setFullYear(nextDue.getFullYear() + 1)
      break
    case ScheduleFrequency.CUSTOM:
      // For custom frequency, default to weekly
      nextDue.setDate(nextDue.getDate() + 7)
      break
    default:
      nextDue.setDate(nextDue.getDate() + 7) // Default to weekly
  }
  
  return nextDue
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; scheduleId: string } }
) {
  try {
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
    const nextDue = calculateNextDueDate(currentSchedule.frequency, now)

    // Update everything in a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create completion log
      const log = await tx.roomScheduleCompletionLog.create({
        data: {
          roomScheduleId: params.scheduleId,
          completedAt: now,
          completedTasks: completedTasks as Prisma.JsonValue,
          notes: `Completed ${completedTasks.length} tasks for ${currentSchedule.schedule.title}`
        }
      })

      // Update the schedule with completion info and reset for next cycle
      const updated = await tx.roomSchedule.update({
        where: { id: params.scheduleId },
        data: {
          lastCompleted: now,
          nextDue: nextDue,
          status: ScheduleStatus.PENDING, // Reset to pending for next cycle
          startDate: now // Update start date to now
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