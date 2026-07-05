-- AlterTable
ALTER TABLE "users" ADD COLUMN "totpSecret" TEXT,
ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "DocumentJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "document_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "status" "DocumentJobStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "document_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_jobs_userId_status_idx" ON "document_jobs"("userId", "status");

-- CreateIndex
CREATE INDEX "document_jobs_createdAt_idx" ON "document_jobs"("createdAt");
