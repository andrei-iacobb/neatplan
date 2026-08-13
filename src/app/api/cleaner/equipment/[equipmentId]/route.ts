import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessSite, siteScopeWhere } from '@/lib/authz'

export async function GET(
  _request: Request,
  context: { params: Promise<{ equipmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin users should use the admin interface' },
        { status: 403 }
      )
    }

    const { equipmentId } = await context.params
    const equipment = await prisma.equipment.findFirst({
      where: {
        id: equipmentId,
        ...siteScopeWhere(session.user),
      },
      include: {
        schedules: {
          include: {
            schedule: { include: { tasks: true } },
          },
          where: {
            OR: [
              { status: { in: ['PENDING', 'OVERDUE'] } },
              { lastCompleted: { gte: startOfToday() } },
            ],
          },
        },
      },
    })

    // Keep the explicit authorization check as defense in depth. findFirst's site
    // scope is fail-closed and prevents cross-site records from being fetched at all.
    if (!equipment || !canAccessSite(session.user, equipment.siteId)) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })
    }

    const today = startOfToday().getTime()
    return NextResponse.json({
      id: equipment.id,
      name: equipment.name,
      type: equipment.type,
      description: equipment.description,
      assetCode: equipment.assetCode,
      schedules: equipment.schedules
        .map((equipmentSchedule) => ({
          id: equipmentSchedule.id,
          title: equipmentSchedule.schedule.title,
          frequency: equipmentSchedule.frequency,
          nextDue: equipmentSchedule.nextDue.toISOString(),
          status: equipmentSchedule.status,
          completedToday:
            equipmentSchedule.lastCompleted !== null &&
            new Date(equipmentSchedule.lastCompleted).setHours(0, 0, 0, 0) === today,
          estimatedDuration: calculateEstimatedDuration(equipmentSchedule.schedule.tasks),
          tasks: equipmentSchedule.schedule.tasks.map((task) => ({
            id: task.id,
            description: task.description,
            frequency: task.frequency,
            additionalNotes: task.additionalNotes,
          })),
        }))
        .sort((a, b) => Number(a.completedToday) - Number(b.completedToday)),
    })
  } catch (error) {
    console.error('Error fetching equipment for cleaning:', error)
    return NextResponse.json({ error: 'Failed to fetch equipment data' }, { status: 500 })
  }
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function calculateEstimatedDuration(tasks: unknown[]): string {
  const minutes = Math.max(15, tasks.length * 5)
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`
}
