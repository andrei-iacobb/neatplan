import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canAccessSite, siteScopeWhere } from '@/lib/authz'
import { cleanerWorkPriority, combineCleanerWorkPriorities } from '@/lib/cleaner-work-priority'
import { prisma } from '@/lib/db'
import { canUseCleaningPortal } from '@/lib/roles'

export async function GET(
  _request: Request,
  context: RouteContext<'/api/cleaner/service-areas/[roomId]'>
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!canUseCleaningPortal(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { roomId } = await context.params
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const serviceArea = await prisma.room.findFirst({
      where: {
        id: roomId,
        type: 'SERVICE_AREA',
        ...siteScopeWhere(session.user),
      },
      select: {
        id: true,
        name: true,
        description: true,
        floor: true,
        siteId: true,
        schedules: {
          where: {
            OR: [
              { status: { in: ['PENDING', 'OVERDUE'] } },
              { lastCompleted: { gte: today } },
            ],
          },
          select: {
            status: true,
            lastCompleted: true,
            nextDue: true,
            schedule: { select: { tasks: { select: { id: true } } } },
          },
        },
        storedEquipment: {
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
            assetCode: true,
            schedules: {
              where: {
                OR: [
                  { status: { in: ['PENDING', 'OVERDUE'] } },
                  { lastCompleted: { gte: today } },
                ],
              },
              select: {
                status: true,
                lastCompleted: true,
                nextDue: true,
                schedule: { select: { tasks: { select: { id: true } } } },
              },
            },
          },
        },
      },
    })

    if (!serviceArea || !canAccessSite(session.user, serviceArea.siteId)) {
      return NextResponse.json({ error: 'Service area not found' }, { status: 404 })
    }

    const ownPriority = cleanerWorkPriority(serviceArea.schedules)
    const equipment = serviceArea.storedEquipment.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      type: item.type,
      assetCode: item.assetCode,
      priority: cleanerWorkPriority(item.schedules),
      scheduleCount: item.schedules.length,
      totalTasks: item.schedules.reduce((total, schedule) => total + schedule.schedule.tasks.length, 0),
    }))
    const totalTasks = serviceArea.schedules.reduce(
      (total, schedule) => total + schedule.schedule.tasks.length,
      equipment.reduce((total, item) => total + item.totalTasks, 0)
    )

    return NextResponse.json({
      id: serviceArea.id,
      name: serviceArea.name,
      description: serviceArea.description,
      floor: serviceArea.floor,
      priority: combineCleanerWorkPriorities([ownPriority, ...equipment.map((item) => item.priority)]),
      ownCleaning: serviceArea.schedules.length > 0 ? {
        priority: ownPriority,
        scheduleCount: serviceArea.schedules.length,
        totalTasks: serviceArea.schedules.reduce(
          (total, schedule) => total + schedule.schedule.tasks.length,
          0
        ),
      } : null,
      summary: {
        itemCount: equipment.length,
        itemsWithCleaningWork: equipment.filter((item) => item.scheduleCount > 0).length,
        totalTasks,
      },
      equipment,
    })
  } catch (error) {
    console.error('Error fetching cleaner service area:', error)
    return NextResponse.json({ error: 'Failed to load this service area' }, { status: 500 })
  }
}
