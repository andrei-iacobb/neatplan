-- AlterTable
ALTER TABLE "room_schedule_completion_logs" ADD COLUMN     "completedByUserId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "forcePasswordChange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastFailedLoginAt" TIMESTAMP(3),
ADD COLUMN     "settings" JSONB,
ADD COLUMN     "temporaryUnblockUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "equipment_schedule_completion_logs_equipmentScheduleId_idx" ON "equipment_schedule_completion_logs"("equipmentScheduleId");

-- CreateIndex
CREATE INDEX "equipment_schedule_completion_logs_completedAt_idx" ON "equipment_schedule_completion_logs"("completedAt");

-- CreateIndex
CREATE INDEX "equipment_schedules_nextDue_idx" ON "equipment_schedules"("nextDue");

-- CreateIndex
CREATE INDEX "equipment_schedules_status_idx" ON "equipment_schedules"("status");

-- CreateIndex
CREATE INDEX "room_schedule_completion_logs_roomScheduleId_idx" ON "room_schedule_completion_logs"("roomScheduleId");

-- CreateIndex
CREATE INDEX "room_schedule_completion_logs_completedAt_idx" ON "room_schedule_completion_logs"("completedAt");

-- CreateIndex
CREATE INDEX "room_schedules_nextDue_idx" ON "room_schedules"("nextDue");

-- CreateIndex
CREATE INDEX "room_schedules_status_idx" ON "room_schedules"("status");

-- CreateIndex
CREATE INDEX "tasks_userId_idx" ON "tasks"("userId");

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");

-- CreateIndex
CREATE INDEX "user_sessions_isActive_lastActivity_idx" ON "user_sessions"("isActive", "lastActivity");

-- AddForeignKey
ALTER TABLE "room_schedule_completion_logs" ADD CONSTRAINT "room_schedule_completion_logs_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
