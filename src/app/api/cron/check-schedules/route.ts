import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    // Protect cron route: require trusted header or shared secret
    const isVercelCron = request.headers.get('x-vercel-cron') !== null
    const providedSecret =
      request.headers.get('x-cron-secret') || new URL(request.url).searchParams.get('secret')
    const expectedSecret = process.env.CRON_SECRET

    if (!isVercelCron) {
      if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

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