-- Owner-level account support. A hidden user authenticates and authorizes exactly like
-- its role; it is simply omitted from user listings and cannot be mutated by others.
ALTER TABLE "users" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;
