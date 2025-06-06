/*
  Warnings:

  - The values [CUSTOM] on the enum `ScheduleFrequency` will be removed. If these variants are still used in the database, this will fail.
  - The values [PAUSED] on the enum `ScheduleStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ScheduleFrequency_new" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
ALTER TABLE "schedules" ALTER COLUMN "suggestedFrequency" TYPE "ScheduleFrequency_new" USING ("suggestedFrequency"::text::"ScheduleFrequency_new");
ALTER TABLE "room_schedules" ALTER COLUMN "frequency" TYPE "ScheduleFrequency_new" USING ("frequency"::text::"ScheduleFrequency_new");
ALTER TABLE "equipment_schedules" ALTER COLUMN "frequency" TYPE "ScheduleFrequency_new" USING ("frequency"::text::"ScheduleFrequency_new");
ALTER TYPE "ScheduleFrequency" RENAME TO "ScheduleFrequency_old";
ALTER TYPE "ScheduleFrequency_new" RENAME TO "ScheduleFrequency";
DROP TYPE "ScheduleFrequency_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ScheduleStatus_new" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE');
ALTER TABLE "room_schedules" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "room_schedules" ALTER COLUMN "status" TYPE "ScheduleStatus_new" USING ("status"::text::"ScheduleStatus_new");
ALTER TABLE "equipment_schedules" ALTER COLUMN "status" TYPE "ScheduleStatus_new" USING ("status"::text::"ScheduleStatus_new");
ALTER TYPE "ScheduleStatus" RENAME TO "ScheduleStatus_old";
ALTER TYPE "ScheduleStatus_new" RENAME TO "ScheduleStatus";
DROP TYPE "ScheduleStatus_old";
ALTER TABLE "room_schedules" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_schedules" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "frequency" "ScheduleFrequency" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCompleted" TIMESTAMP(3),
    "nextDue" TIMESTAMP(3) NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_schedule_completion_logs" (
    "id" TEXT NOT NULL,
    "equipmentScheduleId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedTasks" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "equipment_schedule_completion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_name_key" ON "equipment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_schedules_equipmentId_scheduleId_key" ON "equipment_schedules"("equipmentId", "scheduleId");

-- AddForeignKey
ALTER TABLE "equipment_schedules" ADD CONSTRAINT "equipment_schedules_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_schedules" ADD CONSTRAINT "equipment_schedules_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_schedule_completion_logs" ADD CONSTRAINT "equipment_schedule_completion_logs_equipmentScheduleId_fkey" FOREIGN KEY ("equipmentScheduleId") REFERENCES "equipment_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
