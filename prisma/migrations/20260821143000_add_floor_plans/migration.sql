-- CreateTable
CREATE TABLE "floor_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floor" TEXT NOT NULL,
    "imagePath" TEXT NOT NULL,
    "imageMimeType" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "floor_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "floor_plans_dimensions_check" CHECK ("imageWidth" > 0 AND "imageHeight" > 0),
    CONSTRAINT "floor_plans_revision_check" CHECK ("revision" > 0)
);

-- CreateTable
CREATE TABLE "floor_plan_regions" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "floorPlanId" TEXT NOT NULL,
    "roomId" TEXT,

    CONSTRAINT "floor_plan_regions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "floor_plan_regions_geometry_check" CHECK (
      "x" >= 0 AND "x" <= 1 AND
      "y" >= 0 AND "y" <= 1 AND
      "width" > 0 AND "width" <= 1 AND
      "height" > 0 AND "height" <= 1 AND
      "x" + "width" <= 1 AND
      "y" + "height" <= 1
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "floor_plans_siteId_floor_key" ON "floor_plans"("siteId", "floor");

-- CreateIndex
CREATE INDEX "floor_plans_siteId_isPublished_idx" ON "floor_plans"("siteId", "isPublished");

-- CreateIndex
CREATE INDEX "floor_plans_createdById_idx" ON "floor_plans"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "floor_plan_regions_floorPlanId_roomId_key" ON "floor_plan_regions"("floorPlanId", "roomId");

-- CreateIndex
CREATE INDEX "floor_plan_regions_floorPlanId_idx" ON "floor_plan_regions"("floorPlanId");

-- CreateIndex
CREATE INDEX "floor_plan_regions_roomId_idx" ON "floor_plan_regions"("roomId");

-- AddForeignKey
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_plan_regions" ADD CONSTRAINT "floor_plan_regions_floorPlanId_fkey" FOREIGN KEY ("floorPlanId") REFERENCES "floor_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_plan_regions" ADD CONSTRAINT "floor_plan_regions_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
