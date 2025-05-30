import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
    
    // Update any completed schedules that are now due again
    await prisma.roomSchedule.updateMany({
      where: {
        status: 'COMPLETED',
        nextDue: {
          lte: now
        }
      },
      data: {
        status: 'PENDING'
      }
    })

    // Update pending schedules to overdue only if they're 24+ hours past due
    await prisma.roomSchedule.updateMany({
      where: {
        status: 'PENDING',
        nextDue: {
          lt: twentyFourHoursAgo // Only overdue if 24+ hours past due
        }
      },
      data: {
        status: 'OVERDUE'
      }
    })

    const roomSchedules = await prisma.roomSchedule.findMany({
      include: {
        schedule: true
      },
      orderBy: {
        nextDue: 'asc'
      }
    })

    return NextResponse.json(roomSchedules)
  } catch (error) {
    console.error('Error fetching room schedules:', error)
    return NextResponse.json(
      { error: 'Error fetching room schedules' },
      { status: 500 }
    )
  }
} 