import { connection, NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessAllSites } from '@/lib/roles'
import { siteScopeWhere } from '@/lib/authz'


// Hard cap on rows pulled per source so an export can never try to materialise years of
// completion history into memory at once. Each source is bounded independently.
const MAX_EXPORT_ROWS = 50_000

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function GET(request: NextRequest) {
  await connection()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const userId = searchParams.get('userId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (dateFrom) dateFilter.gte = new Date(dateFrom)
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      dateFilter.lte = to
    }

    const completedAtFilter = Object.keys(dateFilter).length > 0 ? dateFilter : undefined

    // MANAGERs may only export their own site's completions; OP/DIRECTOR export all sites.
    const scoped = !canAccessAllSites(session.user.role)

    // Room completion logs
    const roomWhere: any = {}
    if (completedAtFilter) roomWhere.completedAt = completedAtFilter
    if (roomId) roomWhere.roomSchedule = { roomId }
    if (userId) roomWhere.completedByUserId = userId
    if (scoped) {
      roomWhere.roomSchedule = { ...(roomWhere.roomSchedule ?? {}), room: siteScopeWhere(session.user) }
    }

    const roomLogs = await prisma.roomScheduleCompletionLog.findMany({
      where: roomWhere,
      include: {
        roomSchedule: {
          include: {
            room: { select: { name: true, floor: true, type: true } },
            schedule: { select: { title: true, tasks: true } },
          },
        },
        completedBy: { select: { name: true, email: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    })

    const equipWhere: any = {}
    if (completedAtFilter) equipWhere.completedAt = completedAtFilter
    if (scoped) equipWhere.equipmentSchedule = { equipment: siteScopeWhere(session.user) }

    const equipLogs = roomId || userId
      ? []
      : await prisma.equipmentScheduleCompletionLog.findMany({
          where: equipWhere,
          include: {
            equipmentSchedule: {
              include: {
                equipment: { select: { name: true, type: true } },
                schedule: { select: { title: true, tasks: true } },
              },
            },
          },
          orderBy: { completedAt: 'desc' },
          take: MAX_EXPORT_ROWS,
        })

    // Build CSV rows
    const header = 'Date,Time,Room/Equipment,Floor,Type,Schedule,Frequency,Completed By,Tasks Done,Total Tasks,Completion %,Notes'

    // Schedule relations are nullable (SetNull on delete); fall back to snapshot columns.
    const roomRows = roomLogs.map((log) => {
      const dt = new Date(log.completedAt)
      const tasks = Array.isArray(log.completedTasks) ? log.completedTasks : []
      const tasksDone = tasks.length
      const totalTasks = log.roomSchedule?.schedule?.tasks.length ?? 0
      const pct = totalTasks > 0 ? Math.round((tasksDone / totalTasks) * 100) : 0
      const completedBy = log.completedBy
        ? `${log.completedBy.name || ''} (${log.completedBy.email})`
        : ''
      return [
        dt.toISOString().split('T')[0],
        dt.toTimeString().split(' ')[0],
        log.roomSchedule?.room?.name ?? log.roomName ?? 'Deleted room',
        log.roomSchedule?.room?.floor || '',
        log.roomSchedule?.room?.type ?? '',
        log.roomSchedule?.schedule?.title ?? log.scheduleTitle ?? 'Deleted schedule',
        log.roomSchedule?.frequency ?? '',
        completedBy,
        String(tasksDone),
        String(totalTasks),
        `${pct}%`,
        log.notes || '',
      ].map(escapeCSV).join(',')
    })

    const equipRows = equipLogs.map((log) => {
      const dt = new Date(log.completedAt)
      const tasks = Array.isArray(log.completedTasks) ? log.completedTasks : []
      const tasksDone = tasks.length
      const totalTasks = log.equipmentSchedule?.schedule?.tasks.length ?? 0
      const pct = totalTasks > 0 ? Math.round((tasksDone / totalTasks) * 100) : 0
      return [
        dt.toISOString().split('T')[0],
        dt.toTimeString().split(' ')[0],
        log.equipmentSchedule?.equipment?.name ?? log.equipmentName ?? 'Deleted equipment',
        '',
        log.equipmentSchedule?.equipment?.type ?? '',
        log.equipmentSchedule?.schedule?.title ?? log.scheduleTitle ?? 'Deleted schedule',
        log.equipmentSchedule?.frequency ?? '',
        '',
        String(tasksDone),
        String(totalTasks),
        `${pct}%`,
        log.notes || '',
      ].map(escapeCSV).join(',')
    })

    // Combine and sort by date+time desc (already sorted from DB, just merge)
    const allRows = [...roomRows, ...equipRows]

    const today = new Date().toISOString().split('T')[0]
    const csv = [header, ...allRows].join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="compliance-report-${today}.csv"`,
      },
    })
  } catch (error) {
    console.error('export-report error', error)
    return NextResponse.json({ error: 'Failed to export report' }, { status: 500 })
  }
}
