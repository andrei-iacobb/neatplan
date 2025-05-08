import { createTRPCRouter, adminProcedure } from "~/server/api/trpc"

export const adminRouter = createTRPCRouter({
  getDashboardStats: adminProcedure.query(async ({ ctx }) => {
    // Room statistics
    const totalRooms = await ctx.prisma.room.count()
    const needsCleaningRooms = await ctx.prisma.room.count({
      where: { status: "dirty" },
    })

    // Task statistics
    const pendingTasks = await ctx.prisma.task.count({
      where: { status: "pending" },
    })
    const completedTasks = await ctx.prisma.task.count({
      where: { status: "completed" },
    })

    // User statistics
    const totalUsers = await ctx.prisma.user.count()
    const cleaners = await ctx.prisma.user.count({
      where: { role: "cleaner" },
    })

    // Staff performance
    const staffPerformance = await ctx.prisma.user.findMany({
      where: { role: "cleaner" },
      select: {
        id: true,
        name: true,
        tasks: {
          select: {
            status: true,
          },
        },
      },
    })

    // Recent tasks
    const recentTasks = await ctx.prisma.task.findMany({
      where: { status: "completed" },
      orderBy: { completedAt: "desc" },
      take: 10,
      include: {
        room: true,
        completedBy: true,
      },
    })

    // Recent documents
    const recentDocuments = await ctx.prisma.document.findMany({
      orderBy: { processedAt: "desc" },
      take: 5,
      include: {
        uploadedBy: true,
      },
    })

    // System statistics
    const avgCleaningTime = 25 // Mock value, would be calculated from actual data
    const totalBuildings = await ctx.prisma.room.groupBy({
      by: ["building"],
      _count: true,
    })

    return {
      roomStats: {
        total: totalRooms,
        needsCleaning: needsCleaningRooms,
        clean: totalRooms - needsCleaningRooms,
      },
      taskStats: {
        pending: pendingTasks,
        completed: completedTasks,
        total: pendingTasks + completedTasks,
      },
      userStats: {
        total: totalUsers,
        cleaners,
      },
      staffPerformance: staffPerformance.map((staff) => {
        const completedTasks = staff.tasks.filter((t) => t.status === "completed").length
        const pendingTasks = staff.tasks.filter((t) => t.status !== "completed").length
        const totalTasks = completedTasks + pendingTasks
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

        return {
          id: staff.id,
          name: staff.name,
          completedTasks,
          pendingTasks,
          completionRate,
        }
      }),
      recentTasks: recentTasks.map((task) => ({
        id: task.id,
        name: task.name,
        status: task.status,
        roomNumber: task.room.number,
        completedBy: task.completedBy?.name || null,
        completedAt: task.completedAt?.toISOString() || null,
      })),
      recentDocuments: recentDocuments.map((doc) => ({
        id: doc.id,
        filename: doc.filename,
        uploadedBy: doc.uploadedBy.name,
        processedAt: doc.processedAt?.toISOString() || doc.createdAt.toISOString(),
        tasksCreated: 15, // Mock value, would be calculated from actual data
      })),
      systemStats: {
        completionRate: Math.round((completedTasks / (pendingTasks + completedTasks || 1)) * 100),
        avgCleaningTime,
        buildings: totalBuildings.length,
        totalTasks: pendingTasks + completedTasks,
        documentsProcessed: await ctx.prisma.document.count(),
      },
    }
  }),
})
