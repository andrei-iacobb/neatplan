import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/authz'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error

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