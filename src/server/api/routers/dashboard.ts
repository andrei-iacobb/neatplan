import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"

export const dashboardRouter = createTRPCRouter({
  getCleanerStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id

    // Get pending tasks count
    const pendingTasks = await ctx.prisma.task.count({
      where: {
        assignedToId: userId,
        status: { not: "completed" },
      },
    })

    // Get completed tasks today count
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const completedToday = await ctx.prisma.task.count({
      where: {
        assignedToId: userId,
        status: "completed",
        completedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    })

    // Get completion rate
    const totalAssigned = await ctx.prisma.task.count({
      where: {
        assignedToId: userId,
      },
    })

    const totalCompleted = await ctx.prisma.task.count({
      where: {
        assignedToId: userId,
        status: "completed",
      },
    })

    const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0

    // Get recent activity
    const recentActivity = await ctx.prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: "completed",
      },
      orderBy: {
        completedAt: "desc",
      },
      take: 5,
      include: {
        room: true,
      },
    })

    return {
      pendingTasks,
      completedToday,
      completionRate,
      recentActivity: recentActivity.map((task) => ({
        action: `Completed ${task.name}`,
        roomName: `${task.room.building} - Room ${task.room.number}`,
        timestamp: task.completedAt?.toISOString() || new Date().toISOString(),
      })),
    }
  }),
})
