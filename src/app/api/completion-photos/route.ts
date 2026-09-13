import { connection, NextResponse } from 'next/server'
import { Prisma } from '@/generated/prisma/client'
import { requireAuth, canAccessSite, type SessionUser } from '@/lib/authz'
import { canUseCleaningPortal } from '@/lib/roles'
import { prisma } from '@/lib/db'
import { EquipmentPhotoError, processEquipmentPhoto } from '@/lib/equipment-photos'
import {
  CompletionPhotoError, completionPhotoInput, completionPhotoSelect, MAX_COMPLETION_PHOTOS,
  PHOTO_ATTACHMENT_WINDOW_MS, publicCompletionPhoto, readCompletionPhotoForm,
  removeCompletionPhoto, storeCompletionPhoto, type CompletionPhotoInput,
} from '@/lib/completion-photos'
import { logger } from '@/lib/logger'

async function ownedCompletions(tx: Prisma.TransactionClient, input: CompletionPhotoInput, user: SessionUser, now: Date) {
  const where = { id: { in: input.completionIds }, completedByUserId: user.id }
  const select = { id: true, completedAt: true, siteId: true, _count: { select: { photos: true } } } as const
  const logs = input.kind === 'room'
    ? (await tx.roomScheduleCompletionLog.findMany({ where,
      select: { ...select, roomSchedule: { select: { roomId: true } } },
    })).map(log => ({ ...log, targetId: log.roomSchedule?.roomId }))
    : (await tx.equipmentScheduleCompletionLog.findMany({ where,
      select: { ...select, equipmentSchedule: { select: { equipmentId: true } } },
    })).map(log => ({ ...log, targetId: log.equipmentSchedule?.equipmentId }))
  if (logs.length !== input.completionIds.length || logs.some(log => !canAccessSite(user, log.siteId))) {
    throw new CompletionPhotoError('Completion not found.', 404)
  }
  if (logs.some(log => !log.targetId || log.targetId !== logs[0].targetId ||
    log.siteId !== logs[0].siteId || log.completedAt.getTime() !== logs[0].completedAt.getTime())) {
    throw new CompletionPhotoError('Attach photos to one sign-off at a time.')
  }
  if (logs.some(log => log.completedAt > now || now.getTime() - log.completedAt.getTime() > PHOTO_ATTACHMENT_WINDOW_MS)) {
    throw new CompletionPhotoError('Photos can only be attached during the first 24 hours after sign-off.', 409)
  }
  return logs
}

async function existingBatch(tx: Prisma.TransactionClient, input: CompletionPhotoInput, user: SessionUser) {
  const photos = await tx.completionPhoto.findMany({
    where: { batchId: input.batchId }, orderBy: { position: 'asc' },
    select: { ...completionPhotoSelect, uploadedById: true, siteId: true,
      roomLogs: { select: { id: true } }, equipmentLogs: { select: { id: true } } },
  })
  if (photos.length === 0) return null
  if (photos.some(photo => {
    const logs = input.kind === 'room' ? photo.roomLogs : photo.equipmentLogs
    return photo.uploadedById !== user.id || !canAccessSite(user, photo.siteId) ||
      logs.length !== input.completionIds.length || logs.some(log => !input.completionIds.includes(log.id))
  })) throw new CompletionPhotoError('This upload belongs to a different sign-off.', 409)
  return photos.map(({ id, caption, width, height, byteSize, createdAt }) =>
    publicCompletionPhoto({ id, caption, width, height, byteSize, createdAt }))
}

export async function POST(request: Request) {
  await connection()
  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  if (!canUseCleaningPortal(auth.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(process.env.NEXTAUTH_URL || request.url).origin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const staged: string[] = []
  let committed = false
  try {
    const form = await readCompletionPhotoForm(request)
    let ids: unknown
    try { ids = JSON.parse(String(form.get('completionIds'))) } catch {
      throw new CompletionPhotoError('Choose the sign-off to attach these photos to.')
    }
    const parsed = completionPhotoInput.safeParse({
      kind: form.get('kind'), completionIds: ids, batchId: form.get('batchId'),
      caption: form.get('caption') ?? undefined,
    })
    if (!parsed.success) throw new CompletionPhotoError('The sign-off or photo caption is invalid.')
    const input = parsed.data
    const files = form.getAll('files')
    if (files.length === 0 || files.length > MAX_COMPLETION_PHOTOS || files.some(file => !(file instanceof File))) {
      throw new CompletionPhotoError('Choose between one and three photos.')
    }

    const existing = await existingBatch(prisma, input, auth.user)
    if (existing) return NextResponse.json({ photos: existing })
    const logs = await ownedCompletions(prisma, input, auth.user, new Date())
    if (logs.some(log => log._count.photos + files.length > MAX_COMPLETION_PHOTOS)) {
      throw new CompletionPhotoError('A sign-off can hold at most three photos.', 409)
    }
    const images: Array<{ imagePath: string; width: number; height: number; byteSize: number }> = []
    for (const file of files) {
      if (!(file instanceof File)) throw new CompletionPhotoError('Choose a photo to upload.')
      const image = await processEquipmentPhoto(file)
      const imagePath = await storeCompletionPhoto(image.bytes)
      staged.push(imagePath)
      images.push({ imagePath, width: image.width, height: image.height, byteSize: image.byteSize })
    }

    const result = await prisma.$transaction(async tx => {
      // Serialize both retries of the same batch and concurrent additions to a sign-off.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.batchId}, 0))::text`
      const retry = await existingBatch(tx, input, auth.user)
      if (retry) return { reused: true, photos: retry }
      if (input.kind === 'room') {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM room_schedule_completion_logs
          WHERE id IN (${Prisma.join(input.completionIds)}) ORDER BY id FOR UPDATE`)
      } else {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM equipment_schedule_completion_logs
          WHERE id IN (${Prisma.join(input.completionIds)}) ORDER BY id FOR UPDATE`)
      }
      const current = await ownedCompletions(tx, input, auth.user, new Date())
      if (current.some(log => log._count.photos + images.length > MAX_COMPLETION_PHOTOS)) {
        throw new CompletionPhotoError('A sign-off can hold at most three photos.', 409)
      }
      const photos = []
      for (const [position, image] of images.entries()) {
        const photo = await tx.completionPhoto.create({
          data: {
            ...image, batchId: input.batchId, position, siteId: current[0].siteId,
            uploadedById: auth.user.id, caption: input.caption || null,
            ...(input.kind === 'room'
              ? { roomLogs: { connect: input.completionIds.map(id => ({ id })) } }
              : { equipmentLogs: { connect: input.completionIds.map(id => ({ id })) } }),
          }, select: completionPhotoSelect,
        })
        photos.push(publicCompletionPhoto(photo))
      }
      return { reused: false, photos }
    })
    committed = !result.reused
    return NextResponse.json({ photos: result.photos }, { status: result.reused ? 200 : 201 })
  } catch (error) {
    if (error instanceof CompletionPhotoError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof EquipmentPhotoError) return NextResponse.json({ error: error.message }, { status: 400 })
    logger.error('Could not attach completion photos', error)
    return NextResponse.json({ error: 'Photos were not saved. Your cleaning sign-off is safe; retry the photo upload.' }, { status: 500 })
  } finally {
    if (!committed) {
      await Promise.all(staged.map(filePath => removeCompletionPhoto(filePath).catch(error => {
        logger.error('Could not remove an uncommitted completion photo', error)
      })))
    }
  }
}
