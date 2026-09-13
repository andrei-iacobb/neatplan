import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ auth: vi.fn(), logs: vi.fn(), equipmentLogs: vi.fn(), batches: vi.fn(), image: vi.fn(), create: vi.fn(), transaction: vi.fn(), process: vi.fn(), store: vi.fn(), remove: vi.fn(), read: vi.fn(), lock: vi.fn() }))
vi.mock('next/server', async () => ({ ...await vi.importActual<typeof import('next/server')>('next/server'), connection: async () => undefined }))
vi.mock('@/lib/authz', async () => ({ ...await vi.importActual<typeof import('@/lib/authz')>('@/lib/authz'), requireAuth: mocks.auth }))
vi.mock('@/lib/db', () => ({ prisma: { roomScheduleCompletionLog: { findMany: mocks.logs }, equipmentScheduleCompletionLog: { findMany: mocks.equipmentLogs }, completionPhoto: { findMany: mocks.batches, findFirst: mocks.image, create: mocks.create }, $transaction: mocks.transaction } }))
vi.mock('@/lib/equipment-photos', async () => ({ ...await vi.importActual<typeof import('@/lib/equipment-photos')>('@/lib/equipment-photos'), processEquipmentPhoto: mocks.process }))
vi.mock('@/lib/completion-photos', async () => ({ ...await vi.importActual<typeof import('@/lib/completion-photos')>('@/lib/completion-photos'), storeCompletionPhoto: mocks.store, removeCompletionPhoto: mocks.remove, readCompletionPhoto: mocks.read }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
const { POST } = await import('@/app/api/completion-photos/route')
const { GET } = await import('@/app/api/completion-photos/[photoId]/route')
const now = new Date()
const batchId = '03773f08-26e9-47d0-a305-e5d8cbdb9645'
const photo = { id: 'photo-1', caption: 'Cleaned surface', width: 100, height: 80, byteSize: 4, createdAt: now }
function log(id = 'log-1') { return { id, completedAt: now, siteId: 'site-a', _count: { photos: 0 }, roomSchedule: { roomId: 'room-1' } } }
function request(options: { ids?: string[]; kind?: string; count?: number; caption?: string; origin?: string } = {}) {
  const form = new FormData()
  form.set('kind', options.kind ?? 'room')
  form.set('completionIds', JSON.stringify(options.ids ?? ['log-1']))
  form.set('batchId', batchId)
  form.set('caption', options.caption ?? 'Cleaned surface')
  for (let i = 0; i < (options.count ?? 1); i++) form.append('files', new File(['photo'], `${i}.jpg`, { type: 'image/jpeg' }))
  return new Request('http://localhost/api/completion-photos', { method: 'POST', body: form, headers: options.origin ? { origin: options.origin } : undefined })
}
function existing(overrides = {}) { return { ...photo, uploadedById: 'cleaner-1', siteId: 'site-a', roomLogs: [{ id: 'log-1' }], equipmentLogs: [], ...overrides } }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: 'cleaner-1', role: 'CLEANER', siteId: 'site-a' } })
  mocks.logs.mockResolvedValue([log()])
  mocks.equipmentLogs.mockResolvedValue([{ ...log(), roomSchedule: undefined, equipmentSchedule: { equipmentId: 'equipment-1' } }])
  mocks.batches.mockResolvedValue([])
  mocks.process.mockResolvedValue({ bytes: Buffer.from('webp'), width: 100, height: 80, byteSize: 4 })
  let index = 0
  mocks.store.mockImplementation(async () => `/data/completion-photos/staged-${++index}.webp`)
  mocks.remove.mockResolvedValue(undefined)
  mocks.create.mockResolvedValue(photo)
  mocks.image.mockResolvedValue({ imagePath: '/data/completion-photos/photo.webp' })
  mocks.read.mockResolvedValue(Buffer.from('webp'))
  mocks.transaction.mockImplementation(async callback => callback({ roomScheduleCompletionLog: { findMany: mocks.logs }, equipmentScheduleCompletionLog: { findMany: mocks.equipmentLogs }, completionPhoto: { findMany: mocks.batches, create: mocks.create }, $queryRaw: mocks.lock }))
})

describe('completion photo authorization', () => {
  it('requires authentication before processing files', async () => {
    mocks.auth.mockResolvedValue({ error: Response.json({ error: 'Unauthorized' }, { status: 401 }) })
    expect((await POST(request())).status).toBe(401)
    expect(mocks.process).not.toHaveBeenCalled()
  })
  it('rejects cross-origin uploads', async () => {
    expect((await POST(request({ origin: 'https://attacker.invalid' }))).status).toBe(403)
    expect(mocks.logs).not.toHaveBeenCalled()
  })
  it('only looks up the signed-in cleaner own completions', async () => {
    mocks.logs.mockResolvedValue([])
    expect((await POST(request())).status).toBe(404)
    expect(mocks.logs.mock.calls[0][0].where.completedByUserId).toBe('cleaner-1')
    expect(mocks.store).not.toHaveBeenCalled()
  })
  it('conceals a completion outside the cleaner site', async () => {
    mocks.logs.mockResolvedValue([{ ...log(), siteId: 'site-b' }])
    expect((await POST(request())).status).toBe(404)
    expect(mocks.store).not.toHaveBeenCalled()
  })
  it.each([-25 * 60 * 60 * 1000, 60_000])('rejects a completion outside the attachment window (%i ms)', async offset => {
    mocks.logs.mockResolvedValue([{ ...log(), completedAt: new Date(Date.now() + offset) }])
    expect((await POST(request())).status).toBe(409)
    expect(mocks.store).not.toHaveBeenCalled()
  })
  it.each(['different room', 'different sign-off time'])('refuses to combine %s', async mismatch => {
    mocks.logs.mockResolvedValue([log(), { ...log('log-2'), ...(mismatch === 'different room' ? { roomSchedule: { roomId: 'room-2' } } : { completedAt: new Date(now.getTime() - 1000) }) }])
    expect((await POST(request({ ids: ['log-1', 'log-2'] }))).status).toBe(400)
    expect(mocks.store).not.toHaveBeenCalled()
  })
})

describe('attachments and recovery', () => {
  it('shares each uploaded photo across the combined room sign-off', async () => {
    mocks.logs.mockResolvedValue([log(), log('log-2')])
    const response = await POST(request({ ids: ['log-1', 'log-2'], count: 3 }))
    expect(response.status).toBe(201)
    expect((await response.json()).photos).toHaveLength(3)
    expect(mocks.create).toHaveBeenCalledTimes(3)
    expect(mocks.create.mock.calls[0][0].data.roomLogs.connect).toEqual([{ id: 'log-1' }, { id: 'log-2' }])
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it('attaches equipment photos to equipment logs only', async () => {
    expect((await POST(request({ kind: 'equipment' }))).status).toBe(201)
    expect(mocks.create.mock.calls[0][0].data.equipmentLogs.connect).toEqual([{ id: 'log-1' }])
    expect(mocks.create.mock.calls[0][0].data).not.toHaveProperty('roomLogs')
  })
  it('returns an already saved batch without reprocessing or deleting its images', async () => {
    mocks.batches.mockResolvedValue([existing()])
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect((await response.json()).photos[0].imageUrl).toBe('/api/completion-photos/photo-1')
    expect(mocks.process).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it.each([{ uploadedById: 'other-cleaner' }, { roomLogs: [{ id: 'different-log' }] }, { siteId: 'site-b' }])('rejects reusing a batch for a different owner or sign-off', async change => {
    mocks.batches.mockResolvedValue([existing(change)])
    expect((await POST(request())).status).toBe(409)
    expect(mocks.store).not.toHaveBeenCalled()
  })
  it('removes only the losing request staged file when a concurrent retry already committed', async () => {
    mocks.batches.mockResolvedValueOnce([]).mockResolvedValueOnce([existing()])
    expect((await POST(request())).status).toBe(200)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith('/data/completion-photos/staged-1.webp')
  })
  it('enforces the three-photo limit after a concurrent append', async () => {
    mocks.logs.mockResolvedValueOnce([log()]).mockResolvedValueOnce([{ ...log(), _count: { photos: 3 } }])
    expect((await POST(request())).status).toBe(409)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith('/data/completion-photos/staged-1.webp')
  })
  it('cleans all staged files if the transaction fails, without changing the sign-off', async () => {
    mocks.create.mockRejectedValue(new Error('database unavailable'))
    const response = await POST(request({ count: 3 }))
    expect(response.status).toBe(500)
    expect((await response.json()).error).toMatch(/sign-off is safe/)
    expect(mocks.remove.mock.calls.map(([file]) => file)).toEqual([1, 2, 3].map(index => `/data/completion-photos/staged-${index}.webp`))
  })
  it('does not expose stored paths in successful metadata', async () => {
    const response = await POST(request())
    const body = await response.json()
    expect(body.photos[0]).toMatchObject({ id: 'photo-1', caption: 'Cleaned surface', imageUrl: '/api/completion-photos/photo-1' })
    expect(JSON.stringify(body)).not.toMatch(/imagePath|uploadedById|\/data\//)
  })
  it.each([0, 4])('rejects %i files before storing anything', async count => {
    expect((await POST(request({ count }))).status).toBe(400)
    expect(mocks.store).not.toHaveBeenCalled()
  })
})

describe('private image reads', () => {
  const context = { params: Promise.resolve({ photoId: 'photo-1' }) }
  it('serves private WebP bytes with no shared cache or MIME sniffing', async () => {
    const response = await GET(new Request('http://localhost'), context)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/webp')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(mocks.image.mock.calls[0][0].where).toEqual({ id: 'photo-1', siteId: 'site-a' })
    expect(Buffer.from(await response.arrayBuffer())).toEqual(Buffer.from('webp'))
  })
  it('does not read storage for a missing or foreign-site image', async () => {
    mocks.image.mockResolvedValue(null)
    expect((await GET(new Request('http://localhost'), context)).status).toBe(404)
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it('conceals a missing stored file', async () => {
    mocks.read.mockRejectedValue(new Error('ENOENT /private/path'))
    const response = await GET(new Request('http://localhost'), context)
    expect(response.status).toBe(404)
    expect(JSON.stringify(await response.json())).not.toContain('/private/path')
  })
})
