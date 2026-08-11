import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ScheduleStatus } from '@/generated/prisma/enums'
import { requireAdmin, resolveReadSiteId, nestedReadSiteWhere } from '@/lib/authz'


interface DiaryItem {
  id: string
  kind: 'room' | 'equipment'
  targetName: string
  floor?: string | null
  siteName: string
  scheduleTitle: string
  frequency: string
  nextDue: string
  status: string
}
export async function GET(request: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const url = new URL(request.url)
    const startParam = url.searchParams.get('start')
    const endParam = url.searchParams.get('end')

    if (!startParam || !endParam) {
      return NextResponse.json(
        { error: 'Missing start or end query parameter' },
        { status: 400 }
      )
    }

    const start = new Date(startParam)
    const end = new Date(endParam)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      )
    }

    const requestedSiteId = url.searchParams.get('site')
    const siteId = resolveReadSiteId(auth.user, requestedSiteId)

    // Fetch all room schedules with nextDue in range OR overdue
    const roomSchedules = await prisma.roomSchedule.findMany({
      where: {
        ...nestedReadSiteWhere(siteId, 'room'),
        OR: [
          {
            AND: [
              { nextDue: { gte: start } },
              { nextDue: { lt: end } },
              { status: { in: [ScheduleStatus.PENDING, ScheduleStatus.IN_PROGRESS] } }
            ]
          },
          { status: ScheduleStatus.OVERDUE }
        ]
      },
      select: {
        id: true,
        frequency: true,
        nextDue: true,
        status: true,
        room: {
          select: {
            id: true,
            name: true,
            floor: true,
            siteId: true,
            site: { select: { name: true } }
          }
        },
        schedule: {
          select: {
            id: true,
            title: true
          }
        }
      }
    })

    // Fetch all equipment schedules with nextDue in range OR overdue
    const equipmentSchedules = await prisma.equipmentSchedule.findMany({
      where: {
        ...nestedReadSiteWhere(siteId, 'equipment'),
        OR: [
          {
            AND: [
              { nextDue: { gte: start } },
              { nextDue: { lt: end } },
              { status: { in: [ScheduleStatus.PENDING, ScheduleStatus.IN_PROGRESS] } }
            ]
          },
          { status: ScheduleStatus.OVERDUE }
        ]
      },
      select: {
        id: true,
        frequency: true,
        nextDue: true,
        status: true,
        equipment: {
          select: {
            id: true,
            name: true,
            siteId: true,
            site: { select: { name: true } }
          }
        },
        schedule: {
          select: {
            id: true,
            title: true
          }
        }
      }
    })

    // Convert room schedules to diary items
    const roomItems: DiaryItem[] = roomSchedules.map(rs => ({
      id: rs.id,
      kind: 'room' as const,
      targetName: rs.room.name,
      floor: rs.room.floor,
      siteName: rs.room.site?.name || 'Unknown Site',
      scheduleTitle: rs.schedule.title,
      frequency: rs.frequency,
      nextDue: rs.nextDue.toISOString(),
      status: rs.status
    }))

    // Convert equipment schedules to diary items
    const equipmentItems: DiaryItem[] = equipmentSchedules.map(es => ({
      id: es.id,
      kind: 'equipment' as const,
      targetName: es.equipment.name,
      siteName: es.equipment.site?.name || 'Unknown Site',
      scheduleTitle: es.schedule.title,
      frequency: es.frequency,
      nextDue: es.nextDue.toISOString(),
      status: es.status
    }))

    // Merge and sort by nextDue, with OVERDUE items first
    const allItems = [...roomItems, ...equipmentItems].sort((a, b) => {
      if (a.status === ScheduleStatus.OVERDUE && b.status !== ScheduleStatus.OVERDUE) return -1
      if (a.status !== ScheduleStatus.OVERDUE && b.status === ScheduleStatus.OVERDUE) return 1
      return new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime()
    })

    return NextResponse.json(allItems)
  } catch (error) {
    console.error('Error fetching diary data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch diary data' },
      { status: 500 }
    )
  }
}
