import { connection, NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { nestedSiteScopeWhere } from '@/lib/authz'
import { ScheduleFrequency } from '@/generated/prisma/enums'


const FREQUENCY_DAYS: Record<ScheduleFrequency, number> = {
  DAILY: 1,
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
  QUARTERLY: 90,
  SEMIANNUAL: 182,
  YEARLY: 365,
}

const PERIOD_DAYS: Record<string, number> = {
  week: 7,
  month: 30,
  quarter: 90,
}

export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'week'
    const periodDays = PERIOD_DAYS[period] || 7

    const now = new Date()
    const from = new Date(now)
    from.setDate(from.getDate() - periodDays)
    from.setHours(0, 0, 0, 0)

    // Get all active room schedules. MANAGERs are limited to their own site (reached via
    // the room relation); OP/DIRECTOR see every site.
    const roomSchedules = await prisma.roomSchedule.findMany({
      where: {
        status: { not: 'COMPLETED' as any },
        ...nestedSiteScopeWhere(session.user, 'room'),
      },
      include: {
        room: { select: { id: true, name: true } },
        completionLogs: {
          where: {
            completedAt: { gte: from, lte: now },
          },
        },
      },
    })

    let totalExpected = 0
    let totalActual = 0
    const byFrequency: Record<string, { expected: number; actual: number }> = {}
    const byRoom: Array<{
      roomName: string
      roomId: string
      rate: number
      expected: number
      actual: number
    }> = []

    for (const rs of roomSchedules) {
      const freqDays = FREQUENCY_DAYS[rs.frequency] || 1
      const expected = Math.max(1, Math.floor(periodDays / freqDays))
      const actual = rs.completionLogs.length

      totalExpected += expected
      totalActual += actual

      // By frequency
      const freqKey = rs.frequency
      if (!byFrequency[freqKey]) byFrequency[freqKey] = { expected: 0, actual: 0 }
      byFrequency[freqKey].expected += expected
      byFrequency[freqKey].actual += actual

      // By room
      byRoom.push({
        roomName: rs.room.name,
        roomId: rs.room.id,
        rate: expected > 0 ? Math.round((actual / expected) * 100) : 0,
        expected,
        actual,
      })
    }

    const overallRate = totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 0

    const byFrequencyRates: Record<string, number> = {}
    for (const [freq, data] of Object.entries(byFrequency)) {
      byFrequencyRates[freq] = data.expected > 0 ? Math.round((data.actual / data.expected) * 100) : 0
    }

    return NextResponse.json({
      overallRate,
      byRoom,
      byFrequency: byFrequencyRates,
      period,
      dateRange: { from: from.toISOString(), to: now.toISOString() },
    })
  } catch (error) {
    console.error('compliance-rate error', error)
    return NextResponse.json({ error: 'Failed to calculate compliance rate' }, { status: 500 })
  }
}
