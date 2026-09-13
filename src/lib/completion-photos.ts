import 'server-only'

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

export const MAX_COMPLETION_PHOTOS = 3
export const PHOTO_ATTACHMENT_WINDOW_MS = 24 * 60 * 60 * 1000
const MAX_BODY_BYTES = MAX_COMPLETION_PHOTOS * 12 * 1024 * 1024 + 64 * 1024
const PHOTO_ROOT = path.resolve(process.env.NEATPLAN_DATA_DIR || path.join(process.cwd(), 'data'), 'completion-photos')

export class CompletionPhotoError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

export const completionPhotoInput = z.object({
  kind: z.enum(['room', 'equipment']),
  completionIds: z.array(z.string().min(1).max(100)).min(1).max(20)
    .refine(ids => new Set(ids).size === ids.length, 'A completion was listed twice.'),
  batchId: z.uuid(),
  caption: z.string().trim().max(240).optional(),
})

export type CompletionPhotoInput = z.infer<typeof completionPhotoInput>

// Count actual bytes too: chunked requests need the same bound as Content-Length.
export async function readCompletionPhotoForm(request: Request): Promise<FormData> {
  const type = request.headers.get('content-type') || ''
  if (!type.startsWith('multipart/form-data;')) {
    throw new CompletionPhotoError('Send photos as a form upload.')
  }
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
    throw new CompletionPhotoError('Upload at most three photos, each smaller than 12 MB.', 413)
  }
  const reader = request.body?.getReader()
  if (!reader) throw new CompletionPhotoError('Choose a photo to upload.')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new CompletionPhotoError('Upload at most three photos, each smaller than 12 MB.', 413)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  try {
    return await new Response(Buffer.concat(chunks), { headers: { 'Content-Type': type } }).formData()
  } catch {
    throw new CompletionPhotoError('The photo upload could not be read. Try again.')
  }
}

function storedPath(filePath: string) {
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(`${PHOTO_ROOT}${path.sep}`)) throw new CompletionPhotoError('Photo not found.', 404)
  return resolved
}

export async function storeCompletionPhoto(bytes: Buffer) {
  await fs.mkdir(PHOTO_ROOT, { recursive: true })
  const filePath = path.join(PHOTO_ROOT, `${randomUUID()}.webp`)
  await fs.writeFile(filePath, bytes, { flag: 'wx' })
  return filePath
}

export async function removeCompletionPhoto(filePath: string) {
  await fs.rm(storedPath(filePath), { force: true })
}

export async function readCompletionPhoto(filePath: string) {
  return fs.readFile(storedPath(filePath))
}

export const completionPhotoSelect = {
  id: true, caption: true, width: true, height: true, byteSize: true, createdAt: true,
} as const

export function publicCompletionPhoto<T extends { id: string }>(photo: T) {
  return { ...photo, imageUrl: `/api/completion-photos/${photo.id}` }
}
