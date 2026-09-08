import { NextResponse } from 'next/server'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/db'
import { canAccessSite, requireRole } from '@/lib/authz'
import { saveFloorPlanRegionsSchema } from '@/lib/floor-plan-validation'

class StaleFloorPlanError extends Error {}
class InvalidFloorPlanRoomsError extends Error {}

export async function PUT(request: Request, context: RouteContext<'/api/floor-plans/[id]/regions'>) {
  const auth = await requireRole('HEAD_OF_HOUSEKEEPING')
  if ('error' in auth) return auth.error

  try {
    const { id } = await context.params
    const input = saveFloorPlanRegionsSchema.parse(await request.json())
    const plan = await prisma.floorPlan.findUnique({
      where: { id },
      select: { id: true, siteId: true, revision: true },
    })
    if (!plan || !canAccessSite(auth.user, plan.siteId)) {
      return NextResponse.json({ error: 'Floor plan not found.' }, { status: 404 })
    }

    const roomIds = input.regions.flatMap((region) => region.roomId ? [region.roomId] : [])
    const save = () => prisma.$transaction(async (transaction) => {
      // Recheck membership in every attempt so a concurrent room transfer cannot
      // leave a marker pointing into another site.
      const roomCount = await transaction.room.count({ where: { id: { in: roomIds }, siteId: plan.siteId } })
      if (roomCount !== roomIds.length) throw new InvalidFloorPlanRoomsError()

      const claimed = await transaction.floorPlan.updateMany({
        where: { id, revision: input.revision },
        data: {
          revision: { increment: 1 },
          isPublished: false,
          publishedAt: null,
          updatedAt: new Date(),
        },
      })
      if (claimed.count !== 1) throw new StaleFloorPlanError()

      await transaction.floorPlanRegion.deleteMany({ where: { floorPlanId: id } })
      if (input.regions.length > 0) {
        await transaction.floorPlanRegion.createMany({
          data: input.regions.map((region) => ({
            floorPlanId: id,
            roomId: region.roomId,
            label: region.label,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
          })),
        })
      }

      return transaction.floorPlan.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          revision: true,
          isPublished: true,
          updatedAt: true,
          regions: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              label: true,
              roomId: true,
              x: true,
              y: true,
              width: true,
              height: true,
              room: { select: { id: true, name: true, floor: true, type: true } },
            },
          },
        },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    // Serializable transactions can conflict even when editors touch different
    // plans. Retry only rolled-back database conflicts, at most three attempts.
    for (let attempt = 0; ; attempt++) {
      try {
        return NextResponse.json(await save())
      } catch (error) {
        if (attempt >= 2 ||
          !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')) {
          throw error
        }
      }
    }
  } catch (error) {
    if (error instanceof InvalidFloorPlanRoomsError) {
      return NextResponse.json({ error: 'One or more selected rooms do not belong to this site.' }, { status: 400 })
    }
    if (error instanceof StaleFloorPlanError ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')) {
      return NextResponse.json({ error: 'This plan changed in another session. Reload it before saving.' }, { status: 409 })
    }
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'One or more marked areas are invalid.' }, { status: 400 })
    }
    console.error('Failed to save floor plan regions:', error)
    return NextResponse.json({ error: 'Could not save the marked rooms.' }, { status: 500 })
  }
}
