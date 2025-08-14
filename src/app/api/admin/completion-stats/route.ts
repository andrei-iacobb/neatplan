import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = startOfDay(new Date())
    const days: string[] = []
    const counts: number[] = []

    for (let i = 6; i >= 0; i--) {
      const dayStart = addDays(today, -i)
      const dayEnd = addDays(dayStart, 1)
      days.push(dayStart.toISOString())

      const [roomCount, equipmentCount] = await Promise.all([
        prisma.roomScheduleCompletionLog.count({
          where: { completedAt: { gte: dayStart, lt: dayEnd } }
        }),
        prisma.equipmentScheduleCompletionLog.count({
          where: { completedAt: { gte: dayStart, lt: dayEnd } }
        })
      ])

      counts.push(roomCount + equipmentCount)
    }

    return NextResponse.json({ days, counts })
  } catch (error) {
    console.error('completion-stats error', error)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}


