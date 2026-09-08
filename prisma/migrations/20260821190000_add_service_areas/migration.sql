-- Extend rooms with an explicit kind for cupboards and stores that hold cleanable equipment.
ALTER TYPE "RoomType" ADD VALUE 'SERVICE_AREA';

-- Equipment can be stored in one service area. A removed area unassigns its inventory
-- without deleting the equipment or its schedules.
ALTER TABLE "equipment" ADD COLUMN "serviceAreaId" TEXT;

CREATE INDEX "equipment_serviceAreaId_idx" ON "equipment"("serviceAreaId");

ALTER TABLE "equipment"
  ADD CONSTRAINT "equipment_serviceAreaId_fkey"
  FOREIGN KEY ("serviceAreaId") REFERENCES "rooms"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
