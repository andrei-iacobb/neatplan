import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Get overdue room schedules
    const overdueRoomSchedules = await prisma.roomSchedule.findMany({
      where: {
        nextDue: { lt: now },
        status: { in: ['OVERDUE', 'PENDING'] },
      },
      include: {
        room: { select: { name: true, type: true } },
        schedule: { select: { title: true } },
        completionLogs: {
          orderBy: { completedAt: 'desc' },
          take: 1,
        },
      },
    })

    // Get overdue equipment schedules
    const overdueEquipSchedules = await prisma.equipmentSchedule.findMany({
      where: {
        nextDue: { lt: now },
        status: { in: ['OVERDUE', 'PENDING'] },
      },
      include: {
        equipment: { select: { name: true, type: true } },
        schedule: { select: { title: true } },
        completionLogs: {
          orderBy: { completedAt: 'desc' },
          take: 1,
        },
      },
    })

    const items: Array<{
      id: string
      name: string
      type: 'room' | 'equipment'
      itemType: string
      scheduleName: string
      frequency: string
      nextDue: string
      daysOverdue: number
      lastCompleted: string | null
      severity: 'critical' | 'warning' | 'attention'
    }> = []

    for (const rs of overdueRoomSchedules) {
      const daysOverdue = Math.floor((now.getTime() - rs.nextDue.getTime()) / (1000 * 60 * 60 * 24))
      items.push({
        id: rs.id,
        name: rs.room.name,
        type: 'room',
        itemType: rs.room.type,
        scheduleName: rs.schedule.title,
        frequency: rs.frequency,
        nextDue: rs.nextDue.toISOString(),
        daysOverdue,
        lastCompleted: rs.completionLogs[0]?.completedAt.toISOString() || null,
        severity: daysOverdue >= 7 ? 'critical' : daysOverdue >= 3 ? 'warning' : 'attention',
      })
    }

    for (const es of overdueEquipSchedules) {
      const daysOverdue = Math.floor((now.getTime() - es.nextDue.getTime()) / (1000 * 60 * 60 * 24))
      items.push({
        id: es.id,
        name: es.equipment.name,
        type: 'equipment',
        itemType: es.equipment.type,
        scheduleName: es.schedule.title,
        frequency: es.frequency,
        nextDue: es.nextDue.toISOString(),
        daysOverdue,
        lastCompleted: es.completionLogs[0]?.completedAt.toISOString() || null,
        severity: daysOverdue >= 7 ? 'critical' : daysOverdue >= 3 ? 'warning' : 'attention',
      })
    }

    // Sort by daysOverdue desc (most overdue first)
    items.sort((a, b) => b.daysOverdue - a.daysOverdue)

    const critical = items.filter((i) => i.severity === 'critical').length
    const warning = items.filter((i) => i.severity === 'warning').length
    const attention = items.filter((i) => i.severity === 'attention').length

    return NextResponse.json({
      total: items.length,
      critical,
      warning,
      attention,
      items,
    })
  } catch (error) {
    console.error('overdue-summary error', error)
    return NextResponse.json({ error: 'Failed to load overdue summary' }, { status: 500 })
  }
}
