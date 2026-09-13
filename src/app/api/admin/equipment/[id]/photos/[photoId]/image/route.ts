import { connection, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, siteScopeWhere } from '@/lib/authz'
import { EquipmentPhotoError, readEquipmentPhoto } from '@/lib/equipment-photos'

/**
 * Serve one identification photo.
 *
 * Deliberately not a static file: the data volume is never exposed directly, so
 * every read goes through the same site scoping as the record it belongs to.
 *
 * Readable by any authenticated user at the site, not just management. A cleaner
 * looking at a hoist's tasks benefits most from seeing which hoist it is.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; photoId: string }> }
) {
  await connection()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const { id, photoId } = await context.params

  const photo = await prisma.equipmentPhoto.findFirst({
    where: {
      AND: [{ id: photoId }, { equipmentId: id }, { equipment: siteScopeWhere(auth.user) }],
    },
    select: { imagePath: true, mimeType: true, updatedAt: true },
  })

  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })

  let bytes: Buffer
  try {
    bytes = await readEquipmentPhoto(photo.imagePath)
  } catch (error) {
    if (error instanceof EquipmentPhotoError) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    // The row survives its file going missing; report it as gone rather than 500.
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': photo.mimeType,
      'Content-Length': String(bytes.byteLength),
      // Private: the image is site-scoped, so a shared cache must never hold it.
      // Photos are replaced rather than edited, so a long private TTL is safe and
      // keeps a tablet from refetching every thumbnail on each render.
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': 'inline',
      // The bytes are re-encoded WebP, but belt and braces against a sniffed type.
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
