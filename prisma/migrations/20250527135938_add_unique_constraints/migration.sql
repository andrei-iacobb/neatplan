/*
  Warnings:

  - A unique constraint covering the columns `[roomId,taskDescription]` on the table `cleaning_tasks` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `rooms` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[title]` on the table `schedules` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "cleaning_tasks_roomId_taskDescription_key" ON "cleaning_tasks"("roomId", "taskDescription");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_name_key" ON "rooms"("name");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_title_key" ON "schedules"("title");
