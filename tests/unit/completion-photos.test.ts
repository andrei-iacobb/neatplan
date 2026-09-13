import { afterAll, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'neatplan-completion-photos-'))
const previousDataDir = process.env.NEATPLAN_DATA_DIR
process.env.NEATPLAN_DATA_DIR = scratch
const { completionPhotoInput, readCompletionPhotoForm, storeCompletionPhoto, readCompletionPhoto, removeCompletionPhoto } = await import('@/lib/completion-photos')
afterAll(async () => {
  if (previousDataDir === undefined) delete process.env.NEATPLAN_DATA_DIR
  else process.env.NEATPLAN_DATA_DIR = previousDataDir
  await fs.rm(scratch, { recursive: true, force: true })
})

describe('completion photo input boundaries', () => {
  const valid = { kind: 'room', completionIds: ['completion-1'], batchId: randomUUID(), caption: '  Wiped the surface  ' }
  it('accepts a bounded sign-off and trims its caption', () => {
    expect(completionPhotoInput.parse(valid).caption).toBe('Wiped the surface')
  })
  it.each([
    { completionIds: [] }, { completionIds: ['same', 'same'] }, { completionIds: Array.from({ length: 21 }, (_, i) => `log-${i}`) },
    { batchId: 'not-a-uuid' }, { kind: 'other' }, { caption: 'x'.repeat(241) },
  ])('refuses invalid association or caption %j', override => {
    expect(completionPhotoInput.safeParse({ ...valid, ...override }).success).toBe(false)
  })
  it('reads an actual multipart form with repeated files and no declared length', async () => {
    const form = new FormData()
    form.set('caption', 'Surface')
    form.append('files', new File(['one'], 'one.jpg', { type: 'image/jpeg' }))
    form.append('files', new File(['two'], 'two.png', { type: 'image/png' }))
    const result = await readCompletionPhotoForm(new Request('http://localhost', { method: 'POST', body: form }))
    expect(result.get('caption')).toBe('Surface')
    expect(result.getAll('files')).toHaveLength(2)
  })
  it('rejects declared oversized requests before consuming the stream', async () => {
    const request = new Request('http://localhost', { method: 'POST', body: 'unread', headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': String(40 * 1024 * 1024) } })
    await expect(readCompletionPhotoForm(request)).rejects.toMatchObject({ status: 413 })
    expect(request.bodyUsed).toBe(false)
  })
  it('bounds chunked uploads even when Content-Length lies', async () => {
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)) },
      cancel() { cancelled = true },
    })
    const init: RequestInit & { duplex: 'half' } = { method: 'POST', body: stream, duplex: 'half', headers: { 'content-type': 'multipart/form-data; boundary=x', 'content-length': '1' } }
    await expect(readCompletionPhotoForm(new Request('http://localhost', init))).rejects.toMatchObject({ status: 413 })
    expect(cancelled).toBe(true)
  })
  it.each([
    { type: 'application/json', body: '{}' },
    { type: 'multipart/form-data; boundary=missing', body: 'malformed upload' },
  ])('returns a client error for malformed form $type', async ({ type, body }) => {
    await expect(readCompletionPhotoForm(new Request('http://localhost', { method: 'POST', body, headers: { 'content-type': type } }))).rejects.toMatchObject({ status: 400 })
  })
})

describe('private completion photo storage', () => {
  it('stores each upload separately and removes only the chosen file', async () => {
    const bytes = Buffer.from('encoded WebP supplied by processor')
    const first = await storeCompletionPhoto(bytes)
    const second = await storeCompletionPhoto(bytes)
    expect(first).not.toBe(second)
    expect(path.dirname(first)).toBe(path.join(scratch, 'completion-photos'))
    expect(await readCompletionPhoto(first)).toEqual(bytes)
    await removeCompletionPhoto(first)
    await expect(readCompletionPhoto(first)).rejects.toThrow()
    expect(await readCompletionPhoto(second)).toEqual(bytes)
  })
  it('refuses reads and deletes outside the photo directory', async () => {
    const bystander = path.join(scratch, 'private.txt')
    await fs.writeFile(bystander, 'untouched')
    await expect(readCompletionPhoto(bystander)).rejects.toMatchObject({ status: 404 })
    await expect(removeCompletionPhoto(path.join(scratch, 'completion-photos', '..', 'private.txt'))).rejects.toMatchObject({ status: 404 })
    expect(await fs.readFile(bystander, 'utf8')).toBe('untouched')
  })
})
