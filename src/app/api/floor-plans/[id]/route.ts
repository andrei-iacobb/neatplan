import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { canAccessSite, requireRole } from '@/lib/authz'
import { floorPlanPublishIssue, floorPlanPublishSchema } from '@/lib/floor-plan-validation'

export async function PATCH(request: Request, context: RouteContext<'/api/floor-plans/[id]'>) {
  const auth = await requireRole('HEAD_OF_HOUSEKEEPING')
  if ('error' in auth) return auth.error

  try {
    const { id } = await context.params
    const body = floorPlanPublishSchema.parse(await request.json())
    const plan = await prisma.floorPlan.findUnique({
      where: { id },
      select: { id: true, siteId: true, revision: true, regions: { select: { roomId: true } } },
    })
    if (!plan || !canAccessSite(auth.user, plan.siteId)) {
      return NextResponse.json({ error: 'Floor plan not found.' }, { status: 404 })
    }
    if (plan.revision !== body.revision) {
      return NextResponse.json({ error: 'This plan changed in another session. Reload it before continuing.' }, { status: 409 })
    }

    if (body.action === 'publish') {
      const issue = floorPlanPublishIssue(plan.regions)
      if (issue) return NextResponse.json({ error: issue }, { status: 422 })
    }

    const changed = await prisma.floorPlan.updateMany({
      where: { id, revision: body.revision },
      data: {
        isPublished: body.action === 'publish',
        publishedAt: body.action === 'publish' ? new Date() : null,
        revision: { increment: 1 },
        updatedAt: new Date(),
      },
    })
    if (changed.count !== 1) {
      return NextResponse.json({ error: 'This plan changed in another session. Reload it before continuing.' }, { status: 409 })
    }

    const updated = await prisma.floorPlan.findUniqueOrThrow({
      where: { id },
      select: { id: true, isPublished: true, publishedAt: true, revision: true, updatedAt: true },
    })
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid floor plan update.' }, { status: 400 })
    }
    console.error('Failed to update floor plan:', error)
    return NextResponse.json({ error: 'Could not update the floor plan.' }, { status: 500 })
  }
}
