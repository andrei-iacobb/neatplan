import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    // Get recent room schedule completions
    const recentRoomCompletions = await prisma.roomScheduleCompletionLog.findMany({
      include: {
        roomSchedule: {
          include: {
            room: {
              select: {
                name: true,
                type: true
              }
            },
            schedule: {
              select: {
                title: true
              }
            }
          }
        }
      },
      orderBy: {
        completedAt: 'desc'
      },
      take: 5
    })

    // Get recent equipment schedule completions
    const recentEquipmentCompletions = await prisma.equipmentScheduleCompletionLog.findMany({
      include: {
        equipmentSchedule: {
          include: {
            equipment: {
              select: {
                name: true,
                type: true
              }
            },
            schedule: {
              select: {
                title: true
              }
            }
          }
        }
      },
      orderBy: {
        completedAt: 'desc'
      },
      take: 5
    })

    // Get recent user sessions
    const recentSessions = await prisma.userSession.findMany({
      include: {
        user: {
          select: {
            email: true,
            name: true,
            isAdmin: true
          }
        }
      },
      orderBy: {
        lastActivity: 'desc'
      },
      take: 5
    })

    // Combine and format all activities
    const activities = [
      // Room completions
      ...recentRoomCompletions.map(log => ({
        id: log.id,
        type: 'room_completion',
        title: `Room "${log.roomSchedule.room.name}" cleaned`,
        description: `${log.roomSchedule.schedule.title} completed`,
        timestamp: log.completedAt,
        userEmail: null, // Not tracked in completion logs currently
        metadata: {
          roomName: log.roomSchedule.room.name,
          roomType: log.roomSchedule.room.type,
          scheduleTitle: log.roomSchedule.schedule.title,
          completedTasks: log.completedTasks
        }
      })),
      
      // Equipment completions
      ...recentEquipmentCompletions.map(log => ({
        id: log.id,
        type: 'equipment_completion',
        title: `Equipment "${log.equipmentSchedule.equipment.name}" serviced`,
        description: `${log.equipmentSchedule.schedule.title} completed`,
        timestamp: log.completedAt,
        userEmail: null, // Not tracked in completion logs currently
        metadata: {
          equipmentName: log.equipmentSchedule.equipment.name,
          equipmentType: log.equipmentSchedule.equipment.type,
          scheduleTitle: log.equipmentSchedule.schedule.title,
          completedTasks: log.completedTasks
        }
      })),
      
      // User sessions
      ...recentSessions.map(session => ({
        id: session.id,
        type: 'user_activity',
        title: `${session.user.name || session.user.email} ${session.isActive ? 'is active' : 'logged out'}`,
        description: `${session.user.isAdmin ? 'Admin' : 'Cleaner'} session activity`,
        timestamp: session.lastActivity,
        userEmail: session.user.email,
        metadata: {
          loginAt: session.loginAt,
          logoutAt: session.logoutAt,
          isActive: session.isActive,
          userRole: session.user.isAdmin ? 'Admin' : 'Cleaner'
        }
      }))
    ]

    // Sort all activities by timestamp (most recent first)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Return the most recent 10 activities
    return NextResponse.json({
      activities: activities.slice(0, 10),
      summary: {
        totalRoomCompletions: recentRoomCompletions.length,
        totalEquipmentCompletions: recentEquipmentCompletions.length,
        totalUserActivities: recentSessions.length
      }
    })

  } catch (error) {
    console.error('Error fetching recent activity:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recent activity' },
      { status: 500 }
    )
  }
} 