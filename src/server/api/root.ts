import { createTRPCRouter } from "~/server/api/trpc"
import { tasksRouter } from "~/server/api/routers/tasks"
import { roomsRouter } from "~/server/api/routers/rooms"
import { documentsRouter } from "~/server/api/routers/documents"
import { dashboardRouter } from "~/server/api/routers/dashboard"
import { adminRouter } from "~/server/api/routers/admin"

export const appRouter = createTRPCRouter({
  tasks: tasksRouter,
  rooms: roomsRouter,
  documents: documentsRouter,
  dashboard: dashboardRouter,
  admin: adminRouter,
})

export type AppRouter = typeof appRouter
