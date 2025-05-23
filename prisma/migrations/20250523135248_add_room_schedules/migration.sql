-- CreateEnum
CREATE TYPE "ScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'OVERDUE', 'COMPLETED', 'PAUSED');

-- CreateTable
CREATE TABLE "room_schedules" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "frequency" "ScheduleFrequency" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCompleted" TIMESTAMP(3),
    "nextDue" TIMESTAMP(3) NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_schedule_completion_logs" (
    "id" TEXT NOT NULL,
    "roomScheduleId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_schedule_completion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "room_schedules_roomId_scheduleId_key" ON "room_schedules"("roomId", "scheduleId");

-- AddForeignKey
ALTER TABLE "room_schedules" ADD CONSTRAINT "room_schedules_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_schedules" ADD CONSTRAINT "room_schedules_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_schedule_completion_logs" ADD CONSTRAINT "room_schedule_completion_logs_roomScheduleId_fkey" FOREIGN KEY ("roomScheduleId") REFERENCES "room_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
