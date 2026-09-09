import { NextResponse } from 'next/server'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/db'
import { canAccessSite, requireRole } from '@/lib/authz'
import { saveFloorPlanRegionsSchema } from '@/lib/floor-plan-validation'

class StaleFloorPlanError extends Error {}
class InvalidFloorPlanRoomsError extends Error {}

// PostgreSQL reports a serialization failure as SQLSTATE 40001. The query builder
// turns that into P2034, but the raw locking read below reports the same failure as
// P2010, and the driver adapter can throw it unwrapped, so match the SQLSTATE
// anywhere in the cause chain instead of one Prisma code.
function isSerializationFailure(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return true
  let current: unknown = error
  for (let depth = 0; current instanceof Error && depth < 4; depth++) {
    if (current.message.includes('40001') || current.message.includes('TransactionWriteConflict')) return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}

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

    // The schema rejects a room linked twice, so one row per id proves membership.
    const roomIds = input.regions.flatMap((region) => region.roomId ? [region.roomId] : [])
    // Hold the linked rooms until this save commits, so a site transfer cannot
    // land between the membership check and the region insert. FOR SHARE blocks
    // an update of rooms."siteId"; id order keeps overlapping saves deadlock-free.
    const lockLinkedRooms = roomIds.length === 0 ? null : Prisma.sql`
      SELECT "id" FROM "rooms"
      WHERE "id" IN (${Prisma.join(roomIds)}) AND "siteId" = ${plan.siteId}
      ORDER BY "id"
      FOR SHARE
    `

    const save = () => prisma.$transaction(async (transaction) => {
      // Relock and recheck membership on every attempt.
      if (lockLinkedRooms) {
        const linkedRooms = await transaction.$queryRaw<Array<{ id: string }>>(lockLinkedRooms)
        if (linkedRooms.length !== roomIds.length) throw new InvalidFloorPlanRoomsError()
      }

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
        if (attempt >= 2 || !isSerializationFailure(error)) throw error
        // Re-entering immediately tends to hit the same conflict, so back off a
        // little, with jitter so concurrent editors do not line up again.
        await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1) + Math.random() * 20))
      }
    }
  } catch (error) {
    if (error instanceof InvalidFloorPlanRoomsError) {
      return NextResponse.json({ error: 'One or more selected rooms do not belong to this site.' }, { status: 400 })
    }
    if (error instanceof StaleFloorPlanError || isSerializationFailure(error)) {
      return NextResponse.json({ error: 'This plan changed in another session. Reload it before saving.' }, { status: 409 })
    }
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'One or more marked areas are invalid.' }, { status: 400 })
    }
    console.error('Failed to save floor plan regions:', error)
    return NextResponse.json({ error: 'Could not save the marked rooms.' }, { status: 500 })
  }
}
