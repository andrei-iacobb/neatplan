-- Equipment gains the same revocable label version Room already carries.
-- Existing rows start at 1 so labels minted after this migration verify straight
-- away; there are no labels in the field yet to invalidate.
ALTER TABLE "equipment" ADD COLUMN "locationTokenVersion" INTEGER NOT NULL DEFAULT 1;
