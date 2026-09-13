-- AlterTable
ALTER TABLE "room_schedule_completion_logs" ADD COLUMN     "siteId" TEXT;

-- AlterTable
ALTER TABLE "equipment_schedule_completion_logs" ADD COLUMN     "siteId" TEXT;

-- CreateTable
CREATE TABLE "completion_photos" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "siteId" TEXT,
    "uploadedById" TEXT,
    "imagePath" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "completion_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RoomCompletionPhotos" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RoomCompletionPhotos_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_EquipmentCompletionPhotos" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EquipmentCompletionPhotos_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "completion_photos_siteId_idx" ON "completion_photos"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "completion_photos_batchId_position_key" ON "completion_photos"("batchId", "position");

-- CreateIndex
CREATE INDEX "_RoomCompletionPhotos_B_index" ON "_RoomCompletionPhotos"("B");

-- CreateIndex
CREATE INDEX "_EquipmentCompletionPhotos_B_index" ON "_EquipmentCompletionPhotos"("B");

-- AddForeignKey
ALTER TABLE "completion_photos" ADD CONSTRAINT "completion_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoomCompletionPhotos" ADD CONSTRAINT "_RoomCompletionPhotos_A_fkey" FOREIGN KEY ("A") REFERENCES "completion_photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoomCompletionPhotos" ADD CONSTRAINT "_RoomCompletionPhotos_B_fkey" FOREIGN KEY ("B") REFERENCES "room_schedule_completion_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EquipmentCompletionPhotos" ADD CONSTRAINT "_EquipmentCompletionPhotos_A_fkey" FOREIGN KEY ("A") REFERENCES "completion_photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EquipmentCompletionPhotos" ADD CONSTRAINT "_EquipmentCompletionPhotos_B_fkey" FOREIGN KEY ("B") REFERENCES "equipment_schedule_completion_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

