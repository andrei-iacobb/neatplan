import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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
    const roomItems = roomLogs.map((log) => ({
      id: log.id,
      type: 'room' as const,
      completedAt: log.completedAt.toISOString(),
      itemName: log.roomSchedule.room.name,
      itemId: log.roomSchedule.room.id,
      floor: log.roomSchedule.room.floor,
      itemType: log.roomSchedule.room.type,
      scheduleName: log.roomSchedule.schedule.title,
      frequency: log.roomSchedule.frequency,
      completedBy: log.completedBy
        ? { name: log.completedBy.name, email: log.completedBy.email }
        : null,
      completedTasks: log.completedTasks,
      totalTasks: log.roomSchedule.schedule.tasks.length,
      notes: log.notes,
    }))

    const equipItems = equipLogs.map((log) => ({
      id: log.id,
      type: 'equipment' as const,
      completedAt: log.completedAt.toISOString(),
      itemName: log.equipmentSchedule.equipment.name,
      itemId: log.equipmentSchedule.equipment.id,
      floor: null,
      itemType: log.equipmentSchedule.equipment.type,
      scheduleName: log.equipmentSchedule.schedule.title,
      frequency: log.equipmentSchedule.frequency,
      completedBy: null,
      completedTasks: log.completedTasks,
      totalTasks: log.equipmentSchedule.schedule.tasks.length,
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
