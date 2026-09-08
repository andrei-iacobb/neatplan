import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessSite } from '@/lib/authz'
import { canUseCleaningPortal } from '@/lib/roles'
import { buildRoomWorkPackage } from '@/lib/combined-room-schedule'

export async function GET(
  request: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  const params = await context.params
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!canUseCleaningPortal(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { roomId } = params

    // Get room with active schedules and tasks
    const room = await prisma.room.findUnique({
      where: {
        id: roomId
      },
      include: {
        schedules: {
          include: {
            schedule: {
              include: {
                tasks: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }
              }
            }
          },
          // Include schedules due soon/overdue plus those completed today
          where: {
            OR: [
              { status: { in: ['PENDING', 'OVERDUE'] } },
              {
                lastCompleted: {
                  gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
              }
            ]
          }
        }
      }
    })

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    // A cleaning user may only open rooms in their own site. Return 404 (not 403) so we don't
    // leak the existence of rooms belonging to other sites.
    if (!canAccessSite(session.user, room.siteId)) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    const schedules = room.schedules
      .map(roomSchedule => ({
        id: roomSchedule.id,
        title: roomSchedule.schedule.title,
        frequency: roomSchedule.frequency,
        nextDue: roomSchedule.nextDue.toISOString(),
        status: roomSchedule.status,
        completedToday: roomSchedule.lastCompleted !== null && roomSchedule.lastCompleted >= startOfToday,
        estimatedDuration: calculateEstimatedDuration(roomSchedule.schedule.tasks),
        tasks: roomSchedule.schedule.tasks.map(task => ({
          id: task.id,
          description: task.description,
          frequency: task.frequency,
          additionalNotes: task.additionalNotes
        }))
      }))
      .sort((a, b) => {
        // Move completedToday to bottom
        if (a.completedToday && !b.completedToday) return 1
        if (!a.completedToday && b.completedToday) return -1
        return 0
      })

    // Transform data for cleaner interface. Schedules remain available as source
    // records, while workPackage is the single due-day checklist the cleaner sees.
    const transformedRoom = {
      id: room.id,
      name: room.name,
      type: room.type,
      floor: room.floor || 'Unknown Floor',
      description: room.description,
      schedules,
      workPackage: buildRoomWorkPackage(schedules, now),
    }

    return NextResponse.json(transformedRoom)

  } catch (error) {
    console.error('Error fetching room for cleaning:', error)
    return NextResponse.json(
      { error: 'Failed to fetch room data' },
      { status: 500 }
    )
  }
}

function calculateEstimatedDuration(tasks: readonly unknown[]): string {
  if (tasks.length === 0) return '30min'
  
  // Simple estimation: 5 minutes per task with a minimum of 15 minutes
  const minutes = Math.max(15, tasks.length * 5)
  
  if (minutes < 60) {
    return `${minutes}min`
  } else {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`
  }
}
