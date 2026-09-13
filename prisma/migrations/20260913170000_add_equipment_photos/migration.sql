-- Identification photos for equipment. These describe the asset, not any clean:
-- nothing in the completion path reads them.
CREATE TABLE "equipment_photos" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "uploadedById" TEXT,

    CONSTRAINT "equipment_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "equipment_photos_equipmentId_sortOrder_idx" ON "equipment_photos"("equipmentId", "sortOrder");

-- Deleting the equipment takes its photos with it; the files are removed by the
-- application, which owns the data volume.
ALTER TABLE "equipment_photos" ADD CONSTRAINT "equipment_photos_equipmentId_fkey"
    FOREIGN KEY ("equipmentId") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A departing uploader must not delete the photo, only its attribution.
ALTER TABLE "equipment_photos" ADD CONSTRAINT "equipment_photos_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
