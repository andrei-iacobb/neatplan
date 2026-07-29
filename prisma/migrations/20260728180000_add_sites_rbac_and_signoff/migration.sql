-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('OP', 'DIRECTOR', 'MANAGER', 'CLEANER');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
-- The legacy enum was ('ADMIN', 'CLEANER'). ADMIN meant unrestricted administrative
-- access, which the new hierarchy calls OP. Remap via text before the cast - casting
-- straight to the new type rejects every ADMIN row and fails the whole migration.
ALTER TABLE "users" ALTER COLUMN "role" TYPE TEXT USING ("role"::text);
UPDATE "users" SET "role" = 'OP' WHERE "role" = 'ADMIN';
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CLEANER';
COMMIT;

-- DropIndex
DROP INDEX "equipment_name_key";

-- DropIndex
DROP INDEX "rooms_name_key";

-- DropIndex
DROP INDEX "schedules_title_key";

-- AlterTable
ALTER TABLE "cleaning_tasks" ADD COLUMN     "siteId" TEXT;

-- AlterTable
ALTER TABLE "equipment" ADD COLUMN     "siteId" TEXT;

-- AlterTable
ALTER TABLE "room_schedule_completion_logs" ADD COLUMN     "signatureDataUrl" TEXT,
ADD COLUMN     "signedAt" TIMESTAMP(3),
ADD COLUMN     "signedName" TEXT;

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "siteId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "siteId" TEXT;

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ScheduleToSite" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ScheduleToSite_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "sites_name_key" ON "sites"("name");

-- CreateIndex
CREATE INDEX "_ScheduleToSite_B_index" ON "_ScheduleToSite"("B");

-- CreateIndex
CREATE INDEX "cleaning_tasks_siteId_idx" ON "cleaning_tasks"("siteId");

-- CreateIndex
CREATE INDEX "equipment_siteId_idx" ON "equipment"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_siteId_name_key" ON "equipment"("siteId", "name");

-- CreateIndex
CREATE INDEX "rooms_siteId_idx" ON "rooms"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_siteId_name_key" ON "rooms"("siteId", "name");

-- CreateIndex
CREATE INDEX "users_siteId_idx" ON "users"("siteId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ScheduleToSite" ADD CONSTRAINT "_ScheduleToSite_A_fkey" FOREIGN KEY ("A") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ScheduleToSite" ADD CONSTRAINT "_ScheduleToSite_B_fkey" FOREIGN KEY ("B") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill -------------------------------------------------------------------
-- Site scoping is fail-closed: siteScopeWhere narrows MANAGER/CLEANER queries to their
-- own siteId, and canAccessSite rejects a NULL siteId outright. Without this step every
-- row predating multi-site support becomes invisible, and every MANAGER/CLEANER is left
-- unable to see anything at all. Gather that legacy data into one site so it stays
-- reachable and an OP can redistribute it deliberately.
--
-- Rooms and equipment carried GLOBAL unique indexes on name before this migration (they
-- are dropped above), so rows moving into the new site cannot collide on the new
-- (siteId, name) constraints.
DO $$
DECLARE
  legacy_site_id TEXT;
  has_legacy BOOLEAN;
BEGIN
  SELECT
       EXISTS (SELECT 1 FROM "rooms"          WHERE "siteId" IS NULL)
    OR EXISTS (SELECT 1 FROM "equipment"      WHERE "siteId" IS NULL)
    OR EXISTS (SELECT 1 FROM "cleaning_tasks" WHERE "siteId" IS NULL)
    OR EXISTS (SELECT 1 FROM "users"          WHERE "siteId" IS NULL AND "role" IN ('MANAGER', 'CLEANER'))
    OR EXISTS (SELECT 1 FROM "schedules" s
                WHERE NOT EXISTS (SELECT 1 FROM "_ScheduleToSite" j WHERE j."A" = s."id"))
  INTO has_legacy;

  IF NOT has_legacy THEN
    RETURN;
  END IF;

  INSERT INTO "sites" ("id", "name", "description", "createdAt", "updatedAt")
  VALUES (
    'site_legacy_backfill',
    'Unassigned',
    'Holds records that pre-date multi-site support. Reassign them to real sites, then delete this site.',
    now(), now()
  )
  ON CONFLICT DO NOTHING;

  SELECT "id" INTO legacy_site_id FROM "sites" WHERE "name" = 'Unassigned';

  UPDATE "rooms"          SET "siteId" = legacy_site_id WHERE "siteId" IS NULL;
  UPDATE "equipment"      SET "siteId" = legacy_site_id WHERE "siteId" IS NULL;
  UPDATE "cleaning_tasks" SET "siteId" = legacy_site_id WHERE "siteId" IS NULL;

  -- OP and DIRECTOR legitimately keep a NULL siteId - that is how they span every site.
  -- Only MANAGER and CLEANER must be pinned, and an unpinned one can see nothing today.
  UPDATE "users"
     SET "siteId" = legacy_site_id
   WHERE "siteId" IS NULL AND "role" IN ('MANAGER', 'CLEANER');

  INSERT INTO "_ScheduleToSite" ("A", "B")
  SELECT s."id", legacy_site_id
    FROM "schedules" s
   WHERE NOT EXISTS (SELECT 1 FROM "_ScheduleToSite" j WHERE j."A" = s."id")
  ON CONFLICT DO NOTHING;
END $$;
