-- Give an equipment clean the same sign-off record a room clean already has:
-- who completed it, the signature drawn on their device, and the printed name.
-- All nullable, so existing rows are untouched.
ALTER TABLE "equipment_schedule_completion_logs"
  ADD COLUMN IF NOT EXISTS "completedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "signatureDataUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "signedName" TEXT,
  ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "equipment_schedule_completion_logs_completedByUserId_idx"
  ON "equipment_schedule_completion_logs"("completedByUserId");

DO $$
BEGIN
  ALTER TABLE "equipment_schedule_completion_logs"
    ADD CONSTRAINT "equipment_schedule_completion_logs_completedByUserId_fkey"
    FOREIGN KEY ("completedByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
