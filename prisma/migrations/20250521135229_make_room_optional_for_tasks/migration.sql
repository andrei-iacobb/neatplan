-- AlterEnum
ALTER TYPE "RoomType" ADD VALUE 'BEDROOM';

-- DropForeignKey
ALTER TABLE "cleaning_tasks" DROP CONSTRAINT "cleaning_tasks_roomId_fkey";

-- AlterTable
ALTER TABLE "cleaning_tasks" ALTER COLUMN "roomId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
