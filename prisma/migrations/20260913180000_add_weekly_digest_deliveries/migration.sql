-- One row per person per week. The unique constraint is the idempotency: a
-- fifteen-minute scheduler tick, a container restart and an external cron all
-- hitting the same Monday must produce one email between them.
CREATE TYPE "DigestDeliveryStatus" AS ENUM ('SENT', 'FAILED');

CREATE TABLE "weekly_digest_deliveries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    -- A LOCAL calendar day, stored as text. A timestamp would drag a timezone
    -- back into the key and make the same week hash differently either side of
    -- a clock change.
    "weekStart" TEXT NOT NULL,
    "status" "DigestDeliveryStatus" NOT NULL DEFAULT 'SENT',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "dueCount" INTEGER NOT NULL DEFAULT 0,
    "overdueCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_digest_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "weekly_digest_deliveries_userId_weekStart_key"
    ON "weekly_digest_deliveries"("userId", "weekStart");

CREATE INDEX "weekly_digest_deliveries_weekStart_idx"
    ON "weekly_digest_deliveries"("weekStart");

ALTER TABLE "weekly_digest_deliveries" ADD CONSTRAINT "weekly_digest_deliveries_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
