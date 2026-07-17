import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canAccessAllSites } from '@/lib/roles'
import { siteScopeWhere } from '@/lib/authz'

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

    // MANAGERs see only their own site; OP/DIRECTOR span every site. The completion logs
    // reach their site through roomSchedule.room / equipmentSchedule.equipment, and user
    // activity through the session's user. Left empty for site-spanning roles so the
    // existing behaviour (including orphaned "Deleted" logs) is preserved.
    const user = session.user
    const scoped = !canAccessAllSites(user.role)
    const roomLogSiteWhere = scoped ? { roomSchedule: { room: siteScopeWhere(user) } } : {}
    const equipLogSiteWhere = scoped ? { equipmentSchedule: { equipment: siteScopeWhere(user) } } : {}
    const sessionSiteWhere = scoped ? { user: siteScopeWhere(user) } : {}

    // Get recent room schedule completions
    const recentRoomCompletions = await prisma.roomScheduleCompletionLog.findMany({
      where: roomLogSiteWhere,
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
        },
        completedBy: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: {
        completedAt: 'desc'
      },
      take: 5
    })

    // Get recent equipment schedule completions
    const recentEquipmentCompletions = await prisma.equipmentScheduleCompletionLog.findMany({
      where: equipLogSiteWhere,
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
      where: sessionSiteWhere,
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
      ...recentRoomCompletions.map(log => {
        // Relations are nullable (SetNull on delete); fall back to snapshot columns.
        const roomName = log.roomSchedule?.room?.name ?? log.roomName ?? 'Deleted room'
        const scheduleTitle = log.roomSchedule?.schedule?.title ?? log.scheduleTitle ?? 'Deleted schedule'
        return {
          id: log.id,
          type: 'room_completion',
          title: `${log.completedBy?.name || log.completedBy?.email || 'Cleaner'} completed "${scheduleTitle}"`,
          description: `Room "${roomName}" cleaned`,
          timestamp: log.completedAt,
          userEmail: log.completedBy?.email || null,
          metadata: {
            roomName,
            roomType: log.roomSchedule?.room?.type ?? null,
            scheduleTitle,
            completedTasks: log.completedTasks
          }
        }
      }),

      // Equipment completions
      ...recentEquipmentCompletions.map(log => {
        const equipmentName = log.equipmentSchedule?.equipment?.name ?? log.equipmentName ?? 'Deleted equipment'
        const scheduleTitle = log.equipmentSchedule?.schedule?.title ?? log.scheduleTitle ?? 'Deleted schedule'
        return {
          id: log.id,
          type: 'equipment_completion',
          title: `Equipment "${equipmentName}" serviced`,
          description: `${scheduleTitle} completed`,
          timestamp: log.completedAt,
          userEmail: null, // Not tracked in completion logs currently
          metadata: {
            equipmentName,
            equipmentType: log.equipmentSchedule?.equipment?.type ?? null,
            scheduleTitle,
            completedTasks: log.completedTasks
          }
        }
      }),
      
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