import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"

export const tasksRouter = createTRPCRouter({
  getUpcoming: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id

    // Get urgent tasks (overdue)
    const urgentTasks = await ctx.prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { not: "completed" },
        dueDate: { lt: new Date() },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: {
        room: true,
      },
    })

    // Get today's tasks
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    today.setHours(0, 0, 0, 0)
    tomorrow.setHours(0, 0, 0, 0)

    const todayTasks = await ctx.prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { not: "completed" },
        dueDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: {
        room: true,
      },
    })

    // Get upcoming tasks
    const upcomingTasks = await ctx.prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { not: "completed" },
        dueDate: { gte: tomorrow },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: {
        room: true,
      },
    })

    return {
      urgent: urgentTasks.map((task) => ({
        id: task.id,
        name: task.name,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate.toISOString(),
        roomId: task.roomId,
        roomName: `${task.room.building} - Room ${task.room.number}`,
      })),
      today: todayTasks.map((task) => ({
        id: task.id,
        name: task.name,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate.toISOString(),
        roomId: task.roomId,
        roomName: `${task.room.building} - Room ${task.room.number}`,
      })),
      upcoming: upcomingTasks.map((task) => ({
        id: task.id,
        name: task.name,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate.toISOString(),
        roomId: task.roomId,
        roomName: `${task.room.building} - Room ${task.room.number}`,
      })),
    }
  }),

  completeTasks: protectedProcedure
    .input(
      z.object({
        roomId: z.string(),
        taskIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id

      // Update tasks to completed
      await ctx.prisma.task.updateMany({
        where: {
          id: { in: input.taskIds },
          roomId: input.roomId,
        },
        data: {
          status: "completed",
          completedAt: new Date(),
          completedById: userId,
        },
      })

      // Check if all tasks for the room are completed
      const pendingTasks = await ctx.prisma.task.count({
        where: {
          roomId: input.roomId,
          status: { not: "completed" },
        },
      })

      // If no pending tasks, update room status to clean
      if (pendingTasks === 0) {
        await ctx.prisma.room.update({
          where: { id: input.roomId },
          data: {
            status: "clean",
            lastCleaned: new Date(),
          },
        })
      }

      // Create export record for Excel
      await ctx.prisma.taskExport.create({
        data: {
          userId,
          roomId: input.roomId,
          taskIds: input.taskIds,
          exportedAt: new Date(),
        },
      })

      return { success: true }
    }),
})
