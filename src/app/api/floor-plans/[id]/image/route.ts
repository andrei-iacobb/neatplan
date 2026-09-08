import { NextResponse } from 'next/server'
import * as z from 'zod'
import { prisma } from '@/lib/db'
import { canAccessSite, requireAuth, requireRole } from '@/lib/authz'
import { isManagementRole } from '@/lib/roles'
import {
  FloorPlanImageError,
  processFloorPlanFile,
  readFloorPlanImage,
  removeFloorPlanImage,
  storeFloorPlanImage,
} from '@/lib/floor-plan-images'

const replaceImageSchema = z.object({ revision: z.coerce.number().int().positive() })

export async function GET(_request: Request, context: RouteContext<'/api/floor-plans/[id]/image'>) {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  try {
    const { id } = await context.params
    const plan = await prisma.floorPlan.findUnique({
      where: { id },
      select: { siteId: true, isPublished: true, imagePath: true, imageMimeType: true },
    })
    if (!plan || !canAccessSite(auth.user, plan.siteId)) {
      return NextResponse.json({ error: 'Floor plan not found.' }, { status: 404 })
    }
    if (!plan.isPublished && !isManagementRole(auth.user.role)) {
      return NextResponse.json({ error: 'Floor plan not found.' }, { status: 404 })
    }

    const bytes = await readFloorPlanImage(plan.imagePath)
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': plan.imageMimeType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Failed to serve floor plan image:', error)
    return NextResponse.json({ error: 'Floor plan image is unavailable.' }, { status: 404 })
  }
}

export async function PUT(request: Request, context: RouteContext<'/api/floor-plans/[id]/image'>) {
  const auth = await requireRole('HEAD_OF_HOUSEKEEPING')
  if ('error' in auth) return auth.error

  let newImagePath: string | null = null
  try {
    const { id } = await context.params
    const formData = await request.formData()
    const { revision } = replaceImageSchema.parse({ revision: formData.get('revision') })
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Choose a replacement floor plan.' }, { status: 400 })
    }

    const plan = await prisma.floorPlan.findUnique({
      where: { id },
      select: { id: true, siteId: true, revision: true, imagePath: true },
    })
    if (!plan || !canAccessSite(auth.user, plan.siteId)) {
      return NextResponse.json({ error: 'Floor plan not found.' }, { status: 404 })
    }
    if (plan.revision !== revision) {
      return NextResponse.json({ error: 'This plan changed in another session. Reload it before replacing the image.' }, { status: 409 })
    }

    const processed = await processFloorPlanFile(file)
    newImagePath = await storeFloorPlanImage(id, processed.bytes)
    const changed = await prisma.floorPlan.updateMany({
      where: { id, revision },
      data: {
        imagePath: newImagePath,
        imageMimeType: processed.mimeType,
        sourceFileName: processed.sourceFileName,
        imageWidth: processed.width,
        imageHeight: processed.height,
        isPublished: false,
        publishedAt: null,
        revision: { increment: 1 },
        updatedAt: new Date(),
      },
    })
    if (changed.count !== 1) {
      await removeFloorPlanImage(newImagePath)
      newImagePath = null
      return NextResponse.json({ error: 'This plan changed in another session. Reload it before replacing the image.' }, { status: 409 })
    }

    await removeFloorPlanImage(plan.imagePath)
    const updated = await prisma.floorPlan.findUniqueOrThrow({
      where: { id },
      select: { id: true, revision: true, imageWidth: true, imageHeight: true, sourceFileName: true, isPublished: true },
    })
    return NextResponse.json({
      ...updated,
      imageUrl: `/api/floor-plans/${id}/image?v=${updated.revision}`,
    })
  } catch (error) {
    if (newImagePath) await removeFloorPlanImage(newImagePath)
    if (error instanceof FloorPlanImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid floor plan revision.' }, { status: 400 })
    }
    console.error('Failed to replace floor plan image:', error)
    return NextResponse.json({ error: 'Could not replace the floor plan image.' }, { status: 500 })
  }
}
