import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/db'
import {
  readSiteWhere,
  requireRole,
  resolveReadSiteId,
  resolveWriteSiteId,
  siteScopeWhere,
} from '@/lib/authz'
import {
  FloorPlanImageError,
  processFloorPlanFile,
  removeFloorPlanDirectory,
  storeFloorPlanImage,
} from '@/lib/floor-plan-images'
import { floorPlanUploadFieldsSchema } from '@/lib/floor-plan-validation'

const floorPlanSelect = {
  id: true,
  name: true,
  floor: true,
  imageMimeType: true,
  sourceFileName: true,
  imageWidth: true,
  imageHeight: true,
  isPublished: true,
  publishedAt: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  siteId: true,
  site: { select: { id: true, name: true } },
  regions: {
    orderBy: { createdAt: 'asc' as const },
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
} satisfies Prisma.FloorPlanSelect

export async function GET(request: Request) {
  const auth = await requireRole('HEAD_OF_HOUSEKEEPING')
  if ('error' in auth) return auth.error

  try {
    const requestedSiteId = new URL(request.url).searchParams.get('site')
    const siteId = resolveReadSiteId(auth.user, requestedSiteId)
    const plans = await prisma.floorPlan.findMany({
      where: {
        AND: [siteScopeWhere(auth.user), readSiteWhere(siteId)],
      },
      orderBy: [{ site: { name: 'asc' } }, { floor: 'asc' }],
      select: floorPlanSelect,
    })

    return NextResponse.json(plans.map((plan) => ({
      ...plan,
      imageUrl: `/api/floor-plans/${plan.id}/image?v=${plan.revision}`,
    })))
  } catch (error) {
    console.error('Failed to load floor plans:', error)
    return NextResponse.json({ error: 'Could not load floor plans.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireRole('HEAD_OF_HOUSEKEEPING')
  if ('error' in auth) return auth.error

  let createdPlanId: string | null = null
  try {
    const formData = await request.formData()
    const fields = floorPlanUploadFieldsSchema.parse({
      name: formData.get('name'),
      floor: formData.get('floor'),
      siteId: formData.get('siteId') || undefined,
    })
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a floor plan file.' }, { status: 400 })
    }

    const siteId = resolveWriteSiteId(auth.user, fields.siteId)
    if (!siteId) {
      return NextResponse.json({ error: 'Choose the site this floor plan belongs to.' }, { status: 400 })
    }
    const site = await prisma.site.findFirst({
      where: { id: siteId },
      select: { id: true },
    })
    if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 })

    const processed = await processFloorPlanFile(file)
    createdPlanId = randomUUID()
    const imagePath = await storeFloorPlanImage(createdPlanId, processed.bytes)
    const plan = await prisma.floorPlan.create({
      data: {
        id: createdPlanId,
        name: fields.name,
        floor: fields.floor,
        imagePath,
        imageMimeType: processed.mimeType,
        sourceFileName: processed.sourceFileName,
        imageWidth: processed.width,
        imageHeight: processed.height,
        siteId,
        createdById: auth.user.id,
      },
      select: floorPlanSelect,
    })

    return NextResponse.json({
      ...plan,
      imageUrl: `/api/floor-plans/${plan.id}/image?v=${plan.revision}`,
    }, { status: 201 })
  } catch (error) {
    if (createdPlanId) await removeFloorPlanDirectory(createdPlanId)
    if (error instanceof FloorPlanImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'That floor already has a floor plan for this site.' }, { status: 409 })
    }
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Enter a plan name, floor and site.' }, { status: 400 })
    }
    console.error('Failed to create floor plan:', error)
    return NextResponse.json({ error: 'Could not create the floor plan.' }, { status: 500 })
  }
}
