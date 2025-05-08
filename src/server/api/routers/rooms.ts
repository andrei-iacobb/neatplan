import { z } from "zod"
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc"
import { TRPCError } from "@trpc/server"

export const roomsRouter = createTRPCRouter({
  findByQrCode: protectedProcedure.input(z.object({ qrCode: z.string() })).mutation(async ({ ctx, input }) => {
    const room = await ctx.prisma.room.findUnique({
      where: { qrCode: input.qrCode },
    })

    if (!room) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Room not found with this QR code",
      })
    }

    return {
      id: room.id,
      number: room.number,
      building: room.building,
    }
  }),

  findByNumber: protectedProcedure.input(z.object({ roomNumber: z.string() })).mutation(async ({ ctx, input }) => {
    const rooms = await ctx.prisma.room.findMany({
      where: {
        number: {
          contains: input.roomNumber,
          mode: "insensitive",
        },
      },
    })

    return rooms.map((room) => ({
      id: room.id,
      number: room.number,
      building: room.building,
    }))
  }),

  getRoomWithTasks: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const room = await ctx.prisma.room.findUnique({
      where: { id: input.id },
      include: {
        tasks: {
          where: {
            status: { not: "completed" },
          },
          orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
        },
      },
    })

    if (!room) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Room not found",
      })
    }

    return {
      id: room.id,
      number: room.number,
      building: room.building,
      floor: room.floor,
      type: room.type,
      status: room.status,
      lastCleaned: room.lastCleaned?.toISOString() || null,
      tasks: room.tasks.map((task) => ({
        id: task.id,
        name: task.name,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate.toISOString(),
      })),
    }
  }),
})
