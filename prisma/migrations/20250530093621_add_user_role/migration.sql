-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CLEANER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'CLEANER';
