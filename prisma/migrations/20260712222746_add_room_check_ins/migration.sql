-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('QR', 'NFC', 'MANUAL');

-- AlterTable
ALTER TABLE "room_schedule_completion_logs" ADD COLUMN     "checkInId" TEXT,
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "verificationMethod" "VerificationMethod" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "locationTokenVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "room_check_ins" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" "VerificationMethod" NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "locationTokenVersion" INTEGER NOT NULL,

    CONSTRAINT "room_check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_check_ins_userId_roomId_expiresAt_idx" ON "room_check_ins"("userId", "roomId", "expiresAt");

-- CreateIndex
CREATE INDEX "room_check_ins_expiresAt_idx" ON "room_check_ins"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "room_schedule_completion_logs_checkInId_key" ON "room_schedule_completion_logs"("checkInId");

-- AddForeignKey
ALTER TABLE "room_check_ins" ADD CONSTRAINT "room_check_ins_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_check_ins" ADD CONSTRAINT "room_check_ins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_schedule_completion_logs" ADD CONSTRAINT "room_schedule_completion_logs_checkInId_fkey" FOREIGN KEY ("checkInId") REFERENCES "room_check_ins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
