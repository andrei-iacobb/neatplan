import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessAllSites } from '@/lib/roles'
import { siteScopeWhere } from '@/lib/authz'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // MANAGERs only see completions for their own site; OP/DIRECTOR see all sites.
    const scoped = !canAccessAllSites(session.user.role)

    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const userId = searchParams.get('userId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)))

    // Build date filter
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (dateFrom) dateFilter.gte = new Date(dateFrom)
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      dateFilter.lte = to
    }

    const completedAtFilter = Object.keys(dateFilter).length > 0 ? dateFilter : undefined

    // The two log sources are merged and sorted by completedAt, then paginated. To avoid
    // loading the ENTIRE history into memory on every request, cap each source query to the
    // top `page * limit` rows: the merged page [skip, skip+limit) can only draw from the top
    // (skip+limit) rows of either source, so this bound is exact while keeping memory small.
    const skip = (page - 1) * limit
    const take = page * limit

    // Room completion logs
    const roomWhere: any = {}
    if (completedAtFilter) roomWhere.completedAt = completedAtFilter
    if (roomId) roomWhere.roomSchedule = { roomId }
    if (userId) roomWhere.completedByUserId = userId
    if (scoped) {
      roomWhere.roomSchedule = { ...(roomWhere.roomSchedule ?? {}), room: siteScopeWhere(session.user) }
    }

    const [roomLogs, roomTotal] = await Promise.all([
      prisma.roomScheduleCompletionLog.findMany({
        where: roomWhere,
        include: {
          roomSchedule: {
            include: {
              room: { select: { id: true, name: true, floor: true, type: true } },
              schedule: { select: { title: true, tasks: true } },
            },
          },
          completedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { completedAt: 'desc' },
        take,
      }),
      prisma.roomScheduleCompletionLog.count({ where: roomWhere }),
    ])

    // Equipment completion logs (excluded when filtering by room or user - no such linkage)
    const equipWhere: any = {}
    if (completedAtFilter) equipWhere.completedAt = completedAtFilter
    if (scoped) equipWhere.equipmentSchedule = { equipment: siteScopeWhere(session.user) }

    const skipEquip = Boolean(roomId) || Boolean(userId)
    const [equipLogs, equipTotal] = skipEquip
      ? [[] as any[], 0]
      : await Promise.all([
          prisma.equipmentScheduleCompletionLog.findMany({
            where: equipWhere,
            include: {
              equipmentSchedule: {
                include: {
                  equipment: { select: { id: true, name: true, type: true } },
                  schedule: { select: { title: true, tasks: true } },
                },
              },
            },
            orderBy: { completedAt: 'desc' },
            take,
          }),
          prisma.equipmentScheduleCompletionLog.count({ where: equipWhere }),
        ])

    // Map and combine
    // The schedule relation is nullable (SetNull on delete); fall back to the snapshot
    // columns so completions for since-deleted rooms/schedules still render.
    const roomItems = roomLogs.map((log) => ({
      id: log.id,
      type: 'room' as const,
      completedAt: log.completedAt.toISOString(),
      itemName: log.roomSchedule?.room?.name ?? log.roomName ?? 'Deleted room',
      itemId: log.roomSchedule?.room?.id ?? null,
      floor: log.roomSchedule?.room?.floor ?? null,
      itemType: log.roomSchedule?.room?.type ?? null,
      scheduleName: log.roomSchedule?.schedule?.title ?? log.scheduleTitle ?? 'Deleted schedule',
      frequency: log.roomSchedule?.frequency ?? null,
      completedBy: log.completedBy
        ? { name: log.completedBy.name, email: log.completedBy.email }
        : null,
      completedTasks: log.completedTasks,
      totalTasks: log.roomSchedule?.schedule?.tasks.length ?? null,
      notes: log.notes,
    }))

    const equipItems = equipLogs.map((log) => ({
      id: log.id,
      type: 'equipment' as const,
      completedAt: log.completedAt.toISOString(),
      itemName: log.equipmentSchedule?.equipment?.name ?? log.equipmentName ?? 'Deleted equipment',
      itemId: log.equipmentSchedule?.equipment?.id ?? null,
      floor: null,
      itemType: log.equipmentSchedule?.equipment?.type ?? null,
      scheduleName: log.equipmentSchedule?.schedule?.title ?? log.scheduleTitle ?? 'Deleted schedule',
      frequency: log.equipmentSchedule?.frequency ?? null,
      completedBy: null,
      completedTasks: log.completedTasks,
      totalTasks: log.equipmentSchedule?.schedule?.tasks.length ?? null,
      notes: log.notes,
    }))

    // Merge the (already per-source capped) items, sort by completedAt desc, and slice the
    // requested page. total comes from DB counts, not the truncated arrays.
    const allItems = skipEquip
      ? roomItems
      : [...roomItems, ...equipItems]

    allItems.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())

    const total = roomTotal + (skipEquip ? 0 : equipTotal)
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const items = allItems.slice(skip, skip + limit)

    return NextResponse.json({ items, total, page, limit, totalPages })
  } catch (error) {
    console.error('completion-history error', error)
    return NextResponse.json({ error: 'Failed to load completion history' }, { status: 500 })
  }
}
