import { connection, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole, siteScopeWhere } from '@/lib/authz'
import {
  contentLengthExceedsLimit,
  EquipmentPhotoError,
  MAX_PHOTOS_PER_ITEM,
  processEquipmentPhoto,
  removeEquipmentPhoto,
  storeEquipmentPhoto,
} from '@/lib/equipment-photos'

/**
 * Identification photos for one piece of equipment.
 *
 * Optional throughout. Nothing requires a photo, nothing is blocked by the
 * absence of one, and the cleaning flow never asks for one - these describe the
 * asset so a manager can tell four identical hoists apart, not the work done to
 * it.
 */

/** Thrown inside the transaction so the limit check can roll the create back. */
class PhotoLimitReached extends Error {}

/** Whether this caller may see this item at all. Same scope as the equipment API. */
async function findScopedEquipment(user: Parameters<typeof siteScopeWhere>[0], equipmentId: string) {
  return prisma.equipment.findFirst({
    where: { AND: [{ id: equipmentId }, siteScopeWhere(user)] },
    select: { id: true, name: true },
  })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await connection()

  const auth = await requireRole('HEAD_OF_HOUSEKEEPING')
  if ('error' in auth) return auth.error

  const { id } = await context.params
  const equipment = await findScopedEquipment(auth.user, id)
  // Same answer for missing and not-yours, so the response cannot be used to
  // learn what another site owns.
  if (!equipment) return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })

  const photos = await prisma.equipmentPhoto.findMany({
    where: { equipmentId: id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    // imagePath is a server filesystem path and is never sent to a client.
    select: {
      id: true,
      caption: true,
      width: true,
      height: true,
      byteSize: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
    },
  })

  return NextResponse.json({
    photos: photos.map((photo) => ({
      ...photo,
      url: `/api/admin/equipment/${id}/photos/${photo.id}/image`,
    })),
    limit: MAX_PHOTOS_PER_ITEM,
  })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await connection()

  const auth = await requireRole('HEAD_OF_HOUSEKEEPING')
  if ('error' in auth) return auth.error

  // Before formData(), which buffers the entire body into memory regardless of
  // what is in it.
  if (contentLengthExceedsLimit(request.headers.get('content-length'))) {
    return NextResponse.json({ error: 'Photos must be smaller than 12 MB.' }, { status: 413 })
  }

  const { id } = await context.params
  const equipment = await findScopedEquipment(auth.user, id)
  if (!equipment) return NextResponse.json({ error: 'Equipment not found' }, { status: 404 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Send the photo as a form upload.' }, { status: 400 })
  }

  const file = form.get('photo')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose a photo to upload.' }, { status: 400 })
  }

  const rawCaption = form.get('caption')
  const caption =
    typeof rawCaption === 'string' && rawCaption.trim() ? rawCaption.trim().slice(0, 120) : null

  const existing = await prisma.equipmentPhoto.count({ where: { equipmentId: id } })
  if (existing >= MAX_PHOTOS_PER_ITEM) {
    return NextResponse.json(
      { error: `Each item can hold ${MAX_PHOTOS_PER_ITEM} photos. Remove one first.` },
      { status: 409 }
    )
  }

  let processed
  try {
    processed = await processEquipmentPhoto(file)
  } catch (error) {
    if (error instanceof EquipmentPhotoError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    throw error
  }

  const imagePath = await storeEquipmentPhoto(id, processed.bytes)

  try {
    /*
     * Re-count inside the transaction and refuse there too. The check above is
     * the cheap one that avoids processing an image nobody can store; this is
     * the one that actually holds, because two uploads racing each other both
     * read the same count outside a transaction and both pass.
     */
    const photo = await prisma.$transaction(async (tx) => {
      const current = await tx.equipmentPhoto.count({ where: { equipmentId: id } })
      if (current >= MAX_PHOTOS_PER_ITEM) throw new PhotoLimitReached()

      return tx.equipmentPhoto.create({
        data: {
          equipmentId: id,
          imagePath,
          mimeType: processed.mimeType,
          width: processed.width,
          height: processed.height,
          byteSize: processed.byteSize,
          caption,
          sortOrder: current,
          uploadedById: auth.user.id,
        },
        select: { id: true, caption: true, width: true, height: true, byteSize: true, createdAt: true },
      })
    })

    return NextResponse.json(
      { ...photo, url: `/api/admin/equipment/${id}/photos/${photo.id}/image` },
      { status: 201 }
    )
  } catch (error) {
    // The file landed but the row did not - whether because the limit was
    // reached or the write failed. Without this the data volume accumulates
    // images nothing references and nothing can ever delete.
    await removeEquipmentPhoto(imagePath)

    if (error instanceof PhotoLimitReached) {
      return NextResponse.json(
        { error: `Each item can hold ${MAX_PHOTOS_PER_ITEM} photos. Remove one first.` },
        { status: 409 }
      )
    }
    throw error
  }
}
