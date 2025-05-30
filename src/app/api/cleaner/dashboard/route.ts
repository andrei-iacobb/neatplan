import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

export async function GET() {
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
        { error: 'Forbidden - Admin users should use the admin dashboard' },
        { status: 403 }
      )
    }

    // Get all rooms with their schedules and tasks
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
    
    // First, update any completed schedules that are now due again
    await prisma.roomSchedule.updateMany({
      where: {
        status: 'COMPLETED',
        nextDue: {
          lte: now
        }
      },
      data: {
        status: 'PENDING'
      }
    })

    // Update pending schedules to overdue only if they're 24+ hours past due
    await prisma.roomSchedule.updateMany({
      where: {
        status: 'PENDING',
        nextDue: {
          lt: twentyFourHoursAgo // Only overdue if 24+ hours past due
        }
      },
      data: {
        status: 'OVERDUE'
      }
    })

    const rooms = await prisma.room.findMany({
      include: {
        schedules: {
          include: {
            schedule: {
              include: {
                tasks: true
              }
            }
          },
          where: {
            status: {
              in: ['PENDING', 'OVERDUE', 'COMPLETED']
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Get completion stats for today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const completedToday = await prisma.roomScheduleCompletionLog.count({
      where: {
        completedAt: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    // Transform data for cleaner interface - Task-centric approach
    const transformedRooms = rooms
      .filter(room => room.schedules.length > 0) // Only include rooms with active schedules
      .map(room => {
        // Group schedules by priority and type
        const pendingSchedules = room.schedules.filter(s => s.status === 'PENDING')
        const overdueSchedules = room.schedules.filter(s => s.status === 'OVERDUE')
        const completedSchedules = room.schedules.filter(s => s.status === 'COMPLETED')
        const allActiveSchedules = [...overdueSchedules, ...pendingSchedules, ...completedSchedules]
        
        // Calculate overall room priority
        const roomPriority = overdueSchedules.length > 0 ? 'OVERDUE' : 
                           pendingSchedules.some(s => {
                             const nextDue = new Date(s.nextDue)
                             const today = new Date()
                             return nextDue.toDateString() === today.toDateString()
                           }) ? 'DUE_TODAY' : 
                           completedSchedules.length > 0 ? 'COMPLETED' : 'UPCOMING'
        
        // Calculate total tasks and estimated duration across all active schedules
        const totalTasks = allActiveSchedules.reduce((acc, schedule) => acc + schedule.schedule.tasks.length, 0)
        const totalEstimatedMinutes = allActiveSchedules.reduce((acc, schedule) => {
          const scheduleMinutes = Math.max(15, schedule.schedule.tasks.length * 5)
          return acc + scheduleMinutes
        }, 0)
        
        // Find the most urgent due date
        const nextDueDates = allActiveSchedules.map(s => new Date(s.nextDue))
        const earliestDue = nextDueDates.length > 0 ? new Date(Math.min(...nextDueDates.map(d => d.getTime()))) : new Date()
        
        return {
          id: room.id,
          name: room.name,
          type: room.type,
          floor: room.floor || 'Unknown Floor',
          priority: roomPriority,
          nextDue: earliestDue.toISOString(),
          summary: {
            totalSchedules: allActiveSchedules.length,
            totalTasks: totalTasks,
            estimatedDuration: formatDuration(totalEstimatedMinutes),
            overdueCount: overdueSchedules.length,
            pendingCount: pendingSchedules.length,
            completedCount: completedSchedules.length
          },
          schedules: allActiveSchedules.map(roomSchedule => ({
            id: roomSchedule.id,
            title: roomSchedule.schedule.title,
            frequency: roomSchedule.frequency,
            nextDue: roomSchedule.nextDue.toISOString(),
            status: roomSchedule.status,
            tasksCount: roomSchedule.schedule.tasks.length,
            estimatedDuration: calculateEstimatedDuration(roomSchedule.schedule.tasks),
            scheduleType: determineScheduleType(roomSchedule.schedule.title, roomSchedule.frequency)
          }))
        }
      })
      .filter(room => room.schedules.length > 0) // Final filter to ensure rooms have active tasks

    // Calculate stats based on the new structure
    const totalTasks = transformedRooms.reduce((acc, room) => acc + room.summary.totalTasks, 0)

    const overdueRooms = transformedRooms.filter(room => room.priority === 'OVERDUE').length
    const dueTodayRooms = transformedRooms.filter(room => room.priority === 'DUE_TODAY').length
    const completedRooms = transformedRooms.filter(room => room.priority === 'COMPLETED').length
    const pendingRooms = transformedRooms.filter(room => 
      room.priority === 'UPCOMING' || room.priority === 'DUE_TODAY'
    ).length

    const stats = {
      totalTasks,
      completedToday,
      dueTodayRooms,
      overdueRooms,
      completedRooms,
      pendingRooms,
      totalActiveRooms: transformedRooms.length
    }

    return NextResponse.json({
      rooms: transformedRooms,
      stats
    })

  } catch (error) {
    console.error('Error fetching cleaner dashboard data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
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

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min`
  } else {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`
  }
}

function determineScheduleType(title: string, frequency: string): string {
  // Determine schedule type based on title keywords and frequency
  const titleLower = title.toLowerCase()
  
  if (titleLower.includes('deep clean') || titleLower.includes('deep-clean')) {
    return 'Deep Clean'
  } else if (titleLower.includes('maintenance') || titleLower.includes('repair')) {
    return 'Maintenance'
  } else if (titleLower.includes('inspection') || titleLower.includes('check')) {
    return 'Inspection'
  } else if (titleLower.includes('daily') || frequency === 'DAILY') {
    return 'Daily Clean'
  } else if (titleLower.includes('weekly') || frequency === 'WEEKLY') {
    return 'Weekly Clean'
  } else if (titleLower.includes('monthly') || frequency === 'MONTHLY') {
    return 'Monthly Clean'
  } else if (titleLower.includes('quarterly') || frequency === 'QUARTERLY') {
    return 'Quarterly Clean'
  } else {
    return 'Standard Clean'
  }
} 