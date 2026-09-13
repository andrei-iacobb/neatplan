CREATE TABLE "work_assignments" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "siteId" TEXT NOT NULL REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "workDate" DATE NOT NULL,
 "roomId" TEXT REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "equipmentId" TEXT REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "assigneeId" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 "assigneeName" TEXT,
 "assignedById" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 "assignedByName" TEXT,
 "revision" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "work_assignments_one_asset" CHECK (("roomId" IS NOT NULL)::int + ("equipmentId" IS NOT NULL)::int = 1)
);
CREATE UNIQUE INDEX "work_assignments_roomId_workDate_key" ON "work_assignments"("roomId", "workDate");
CREATE UNIQUE INDEX "work_assignments_equipmentId_workDate_key" ON "work_assignments"("equipmentId", "workDate");
CREATE INDEX "work_assignments_siteId_workDate_assigneeId_idx" ON "work_assignments"("siteId", "workDate", "assigneeId");
CREATE INDEX "work_assignments_assigneeId_idx" ON "work_assignments"("assigneeId");
CREATE INDEX "work_assignments_assignedById_idx" ON "work_assignments"("assignedById");
ALTER TABLE "room_schedule_completion_logs" ADD COLUMN "plannedAssigneeId" TEXT, ADD COLUMN "plannedAssigneeName" TEXT, ADD COLUMN "assignmentDate" DATE;
ALTER TABLE "equipment_schedule_completion_logs" ADD COLUMN "plannedAssigneeId" TEXT, ADD COLUMN "plannedAssigneeName" TEXT, ADD COLUMN "assignmentDate" DATE;
