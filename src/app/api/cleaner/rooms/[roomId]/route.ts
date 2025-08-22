import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

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

    // Only cleaners should access this endpoint
    if (session.user.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin users should use the admin interface' },
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
                tasks: true
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

    // Transform data for cleaner interface
    const transformedRoom = {
      id: room.id,
      name: room.name,
      type: room.type,
      floor: room.floor || 'Unknown Floor',
      description: room.description,
      schedules: room.schedules
        .map(roomSchedule => ({
        id: roomSchedule.id,
        title: roomSchedule.schedule.title,
        frequency: roomSchedule.frequency,
        nextDue: roomSchedule.nextDue.toISOString(),
        status: roomSchedule.status,
        completedToday: roomSchedule.lastCompleted && (new Date(roomSchedule.lastCompleted).setHours(0,0,0,0) === new Date().setHours(0,0,0,0)),
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

function calculateEstimatedDuration(tasks: any[]): string {
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