import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Find all schedules that are past their due date and not completed
    const overdueSchedules = await prisma.roomSchedule.updateMany({
      where: {
        nextDue: {
          lt: new Date()
        },
        status: {
          not: 'COMPLETED'
        }
      },
      data: {
        status: 'OVERDUE'
      }
    })

    return NextResponse.json({
      message: `Updated ${overdueSchedules.count} overdue schedules`,
      count: overdueSchedules.count
    })
  } catch (error: any) {
    console.error('Error checking schedules:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to check schedules' },
      { status: 500 }
    )
  }
} 