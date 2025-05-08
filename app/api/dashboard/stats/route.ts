import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions, isAdmin, getUserId } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = getUserId(session)
    const isAdminUser = isAdmin(session)

    // Different stats for admin vs cleaner
    if (isAdminUser) {
      // Admin dashboard stats
      const [roomStats, taskStats, cleanerStats, recentTasks] = await Promise.all([
        // Get room statistics
        prisma.room.groupBy({
          by: ['status'],
          _count: {
            _all: true
          },
          where: {
            status: {
              in: ['clean', 'needs_cleaning', 'in_progress']
            }
          }
        }),

        // Get task statistics
        prisma.task.groupBy({
          by: ['status'],
          _count: {
            _all: true
          },
          where: {
            status: {
              in: ['pending', 'in_progress', 'completed']
            }
          }
        }),

        // Get cleaner statistics
        prisma.user.count({
          where: {
            role: 'cleaner'
          }
        }),

        // Get recent tasks
        prisma.task.findMany({
          take: 5,
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            room: true,
            user: true
          }
        })
      ])

      return NextResponse.json({
        roomStats,
        taskStats,
        cleanerStats,
        recentTasks
      })
    } else {
      // Cleaner dashboard stats
      const [pendingTasks, completedToday, recentActivity] = await Promise.all([
        // Get pending tasks
        prisma.task.count({
          where: {
            assignedTo: userId,
            status: 'pending'
          }
        }),

        // Get tasks completed today
        prisma.task.count({
          where: {
            assignedTo: userId,
            status: 'completed',
            completedAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
          }
        }),

        // Get recent activity
        prisma.task.findMany({
          where: {
            assignedTo: userId
          },
          take: 5,
          orderBy: {
            updatedAt: 'desc'
          },
          include: {
            room: true
          }
        })
      ])

      return NextResponse.json({
        pendingTasks,
        completedToday,
        recentActivity
      })
    }
  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    )
  }
}
