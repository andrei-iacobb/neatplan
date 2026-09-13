import { connection, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole, siteScopeWhere } from '@/lib/authz'
import { removeEquipmentPhoto } from '@/lib/equipment-photos'

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; photoId: string }> }
) {
  await connection()

  const auth = await requireRole('HEAD_OF_HOUSEKEEPING')
  if ('error' in auth) return auth.error

  const { id, photoId } = await context.params

  /*
   * The photo has to belong to this item AND the item to this caller's site.
   * Matching on the photo id alone would let a manager delete another site's
   * photo by guessing an id.
   */
  const photo = await prisma.equipmentPhoto.findFirst({
    where: {
      AND: [{ id: photoId }, { equipmentId: id }, { equipment: siteScopeWhere(auth.user) }],
    },
    select: { id: true, imagePath: true },
  })

  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })

  // Row first: the database is authoritative, and an orphaned file is a tidiness
  // problem where an orphaned row is a broken image in the UI.
  await prisma.equipmentPhoto.delete({ where: { id: photo.id } })
  await removeEquipmentPhoto(photo.imagePath)

  return NextResponse.json({ deleted: true })
}
