import { connection, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessAllSites } from '@/lib/roles'
import { siteScopeWhere, resolveReadSiteId, readSiteWhere } from '@/lib/authz'


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

export async function GET(request: Request) {
  await connection()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // MANAGERs are limited to their own site; OP/DIRECTOR count across every site.
    const user = session.user
    const scoped = !canAccessAllSites(user.role)
    const requestedSiteId = new URL(request.url).searchParams.get('site')
    const siteId = resolveReadSiteId(user, requestedSiteId)
    const readSiteClause = readSiteWhere(siteId)
    const roomLogSiteWhere = {
      AND: [
        scoped ? { roomSchedule: { room: siteScopeWhere(user) } } : {},
        siteId ? { roomSchedule: { room: readSiteClause } } : {},
      ],
    }
    const equipLogSiteWhere = {
      AND: [
        scoped ? { equipmentSchedule: { equipment: siteScopeWhere(user) } } : {},
        siteId ? { equipmentSchedule: { equipment: readSiteClause } } : {},
      ],
    }

    const today = startOfDay(new Date())
    const sevenDaysAgo = addDays(today, -6)

    // Query both tables in parallel, fetching all logs in the 7-day range
    const [roomLogs, equipmentLogs] = await Promise.all([
      prisma.roomScheduleCompletionLog.findMany({
        where: {
          completedAt: { gte: sevenDaysAgo, lt: addDays(today, 1) },
          ...roomLogSiteWhere
        },
        select: { completedAt: true }
      }),
      prisma.equipmentScheduleCompletionLog.findMany({
        where: {
          completedAt: { gte: sevenDaysAgo, lt: addDays(today, 1) },
          ...equipLogSiteWhere
        },
        select: { completedAt: true }
      })
    ])

    // Group completions by day using server-local time boundaries (matching current behavior)
    const countsByDay = new Map<string, number>()

    for (const log of roomLogs) {
      const day = startOfDay(new Date(log.completedAt))
      const dayKey = day.toISOString()
      countsByDay.set(dayKey, (countsByDay.get(dayKey) ?? 0) + 1)
    }

    for (const log of equipmentLogs) {
      const day = startOfDay(new Date(log.completedAt))
      const dayKey = day.toISOString()
      countsByDay.set(dayKey, (countsByDay.get(dayKey) ?? 0) + 1)
    }

    // Build result in the same format as before: days array and counts array
    const days: string[] = []
    const counts: number[] = []

    for (let i = 6; i >= 0; i--) {
      const dayStart = addDays(today, -i)
      const dayKey = dayStart.toISOString()
      days.push(dayKey)
      counts.push(countsByDay.get(dayKey) ?? 0)
    }

    return NextResponse.json({ days, counts })
  } catch (error) {
    console.error('completion-stats error', error)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
