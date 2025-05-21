-- CreateTable
CREATE TABLE "CleaningTask" (
    "id" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "taskDescription" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "estimatedDuration" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CleaningTask_pkey" PRIMARY KEY ("id")
);
