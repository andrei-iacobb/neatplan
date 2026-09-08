-- Additive only: existing users keep their current role.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'HEAD_OF_HOUSEKEEPING' BEFORE 'CLEANER';
