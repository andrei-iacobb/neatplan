/*
  Warnings:

  - Changed the type of `completedTasks` on the `room_schedule_completion_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "room_schedule_completion_logs" DROP COLUMN "completedTasks",
ADD COLUMN     "completedTasks" JSONB NOT NULL;
