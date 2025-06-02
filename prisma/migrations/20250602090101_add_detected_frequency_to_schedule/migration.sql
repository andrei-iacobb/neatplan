-- AlterTable
ALTER TABLE "schedules" ADD COLUMN     "detectedFrequency" TEXT,
ADD COLUMN     "suggestedFrequency" "ScheduleFrequency";
