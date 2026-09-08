-- Earlier application updates introduced these fields without a migration.
-- Keep this safe for installations that already added them with db push.
ALTER TYPE "ScheduleFrequency" ADD VALUE IF NOT EXISTS 'SEMIANNUAL';

ALTER TABLE "equipment"
  ADD COLUMN IF NOT EXISTS "assetCode" TEXT,
  ADD COLUMN IF NOT EXISTS "model" TEXT,
  ADD COLUMN IF NOT EXISTS "serialNumber" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "equipment_siteId_assetCode_key"
  ON "equipment"("siteId", "assetCode");
