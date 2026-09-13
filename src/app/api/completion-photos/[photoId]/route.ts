import { connection, NextResponse } from 'next/server'
import { requireAuth, siteScopeWhere } from '@/lib/authz'
import { prisma } from '@/lib/db'
import { readCompletionPhoto } from '@/lib/completion-photos'

export async function GET(_request: Request, context: { params: Promise<{ photoId: string }> }) {
  await connection()
  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { photoId } = await context.params
  const photo = await prisma.completionPhoto.findFirst({
    where: { id: photoId, ...siteScopeWhere(auth.user) }, select: { imagePath: true },
  })
  if (!photo) return NextResponse.json({ error: 'Photo not found.' }, { status: 404 })
  try {
    const bytes = await readCompletionPhoto(photo.imagePath)
    return new NextResponse(new Uint8Array(bytes), { headers: {
      'Content-Type': 'image/webp', 'Content-Length': String(bytes.byteLength),
      'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    } })
  } catch {
    return NextResponse.json({ error: 'Photo not found.' }, { status: 404 })
  }
}
