-- Separate from the migration that adds PENDING to the enum, on purpose.
-- PostgreSQL will not let a newly added enum value be USED until the transaction
-- that added it has committed, and a column default counts as using it - so the
-- two cannot share a file.
ALTER TABLE "weekly_digest_deliveries" ALTER COLUMN "status" SET DEFAULT 'PENDING';
