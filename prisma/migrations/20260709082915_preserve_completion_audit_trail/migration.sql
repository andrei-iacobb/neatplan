-- DropForeignKey
ALTER TABLE "equipment_schedule_completion_logs" DROP CONSTRAINT "equipment_schedule_completion_logs_equipmentScheduleId_fkey";

-- DropForeignKey
ALTER TABLE "room_schedule_completion_logs" DROP CONSTRAINT "room_schedule_completion_logs_roomScheduleId_fkey";

-- AlterTable
ALTER TABLE "equipment_schedule_completion_logs" ADD COLUMN     "equipmentName" TEXT,
ADD COLUMN     "scheduleTitle" TEXT,
ALTER COLUMN "equipmentScheduleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "room_schedule_completion_logs" ADD COLUMN     "roomName" TEXT,
ADD COLUMN     "scheduleTitle" TEXT,
ALTER COLUMN "roomScheduleId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "room_schedule_completion_logs" ADD CONSTRAINT "room_schedule_completion_logs_roomScheduleId_fkey" FOREIGN KEY ("roomScheduleId") REFERENCES "room_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_schedule_completion_logs" ADD CONSTRAINT "equipment_schedule_completion_logs_equipmentScheduleId_fkey" FOREIGN KEY ("equipmentScheduleId") REFERENCES "equipment_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill snapshot columns for existing rows so historical logs remain readable if their
-- room/equipment/schedule is later deleted.
UPDATE "room_schedule_completion_logs" l
SET "roomName" = r."name",
    "scheduleTitle" = s."title"
FROM "room_schedules" rs
JOIN "rooms" r ON r."id" = rs."roomId"
JOIN "schedules" s ON s."id" = rs."scheduleId"
WHERE l."roomScheduleId" = rs."id"
  AND (l."roomName" IS NULL OR l."scheduleTitle" IS NULL);

UPDATE "equipment_schedule_completion_logs" l
SET "equipmentName" = e."name",
    "scheduleTitle" = s."title"
FROM "equipment_schedules" es
JOIN "equipment" e ON e."id" = es."equipmentId"
JOIN "schedules" s ON s."id" = es."scheduleId"
WHERE l."equipmentScheduleId" = es."id"
  AND (l."equipmentName" IS NULL OR l."scheduleTitle" IS NULL);
