import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  equipmentFindFirst: vi.fn(),
  photoFindMany: vi.fn(),
  photoFindFirst: vi.fn(),
  photoCount: vi.fn(),
  photoCreate: vi.fn(),
  photoDelete: vi.fn(),
  requireRole: vi.fn(),
  requireAuth: vi.fn(),
  processPhoto: vi.fn(),
  storePhoto: vi.fn(),
  readPhoto: vi.fn(),
  removePhoto: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    equipment: { findFirst: mocks.equipmentFindFirst },
    equipmentPhoto: {
      findMany: mocks.photoFindMany,
      findFirst: mocks.photoFindFirst,
      count: mocks.photoCount,
      create: mocks.photoCreate,
      delete: mocks.photoDelete,
    },
  },
}))

vi.mock('@/lib/authz', async () => {
  const actual = await vi.importActual<typeof import('@/lib/authz')>('@/lib/authz')
  return { ...actual, requireRole: mocks.requireRole, requireAuth: mocks.requireAuth }
})

vi.mock('@/lib/equipment-photos', async () => {
  const actual = await vi.importActual<typeof import('@/lib/equipment-photos')>(
    '@/lib/equipment-photos'
  )
  return {
    ...actual,
    processEquipmentPhoto: mocks.processPhoto,
    storeEquipmentPhoto: mocks.storePhoto,
    readEquipmentPhoto: mocks.readPhoto,
    removeEquipmentPhoto: mocks.removePhoto,
  }
})

vi.mock('next/server', () => ({
  connection: async () => undefined,
  NextResponse: Object.assign(
    class {
      constructor(
        public body: unknown,
        public init?: { status?: number; headers?: Record<string, string> }
      ) {}
      get status() {
        return this.init?.status ?? 200
      }
      get headers() {
        return new Map(Object.entries(this.init?.headers ?? {}))
      }
    },
    {
      json: (data: unknown, init?: { status?: number }) => ({
        json: async () => data,
        status: init?.status ?? 200,
      }),
    }
  ),
}))

const list = await import('@/app/api/admin/equipment/[id]/photos/route')
const detail = await import('@/app/api/admin/equipment/[id]/photos/[photoId]/route')
const image = await import('@/app/api/admin/equipment/[id]/photos/[photoId]/image/route')

const MAPLE = 'site_maple'

const params = (id: string, photoId?: string) =>
  ({ params: Promise.resolve(photoId ? { id, photoId } : { id }) }) as never

function allow(role = 'HEAD_OF_HOUSEKEEPING', siteId: string | null = MAPLE) {
  return { user: { id: 'u1', role, siteId } }
}

const refusal = { error: { json: async () => ({ error: 'Forbidden' }), status: 403 } }

function upload(file?: unknown, caption?: string) {
  const form = new FormData()
  if (file !== undefined) form.append('photo', file as Blob)
  if (caption) form.append('caption', caption)
  return { formData: async () => form } as unknown as Request
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireRole.mockResolvedValue(allow())
  mocks.requireAuth.mockResolvedValue(allow('CLEANER'))
  mocks.equipmentFindFirst.mockResolvedValue({ id: 'equip-1', name: 'Hoist 3' })
  mocks.photoFindMany.mockResolvedValue([])
  mocks.photoCount.mockResolvedValue(0)
  mocks.photoCreate.mockResolvedValue({
    id: 'photo-1',
    caption: null,
    width: 800,
    height: 600,
    byteSize: 1234,
    createdAt: new Date(),
  })
  mocks.photoFindFirst.mockResolvedValue({
    id: 'photo-1',
    imagePath: '/data/equipment-photos/equip-1/a.webp',
    mimeType: 'image/webp',
    updatedAt: new Date(),
  })
  mocks.processPhoto.mockResolvedValue({
    bytes: Buffer.from('webp'),
    mimeType: 'image/webp',
    width: 800,
    height: 600,
    byteSize: 4,
  })
  mocks.storePhoto.mockResolvedValue('/data/equipment-photos/equip-1/a.webp')
  mocks.readPhoto.mockResolvedValue(Buffer.from('webp-bytes'))
})

describe('authorization', () => {
  it('gates listing and uploading at the equipment management line', async () => {
    await list.GET(new Request('http://localhost'), params('equip-1'))
    expect(mocks.requireRole).toHaveBeenCalledWith('HEAD_OF_HOUSEKEEPING')

    await list.POST(upload(new File(['x'], 'p.jpg', { type: 'image/jpeg' })), params('equip-1'))
    expect(mocks.requireRole).toHaveBeenCalledWith('HEAD_OF_HOUSEKEEPING')
  })

  it('lets any authenticated user at the site VIEW a photo', async () => {
    // A cleaner opening a hoist's tasks benefits most from seeing which hoist it
    // is, so reading is not restricted to management.
    await image.GET(new Request('http://localhost'), params('equip-1', 'photo-1'))
    expect(mocks.requireAuth).toHaveBeenCalled()
    expect(mocks.requireRole).not.toHaveBeenCalled()
  })

  it('passes a guard refusal straight back without querying', async () => {
    mocks.requireRole.mockResolvedValue(refusal)

    const response = (await list.POST(upload(), params('equip-1'))) as unknown as { status: number }
    expect(response.status).toBe(403)
    expect(mocks.equipmentFindFirst).not.toHaveBeenCalled()
  })
})

describe('site scoping', () => {
  it('scopes the item lookup before doing anything with it', async () => {
    await list.GET(new Request('http://localhost'), params('equip-1'))

    const where = mocks.equipmentFindFirst.mock.calls[0][0].where
    expect(where.AND).toContainEqual({ id: 'equip-1' })
    expect(where.AND).toContainEqual({ siteId: MAPLE })
  })

  it('answers the same for missing and not-yours', async () => {
    // Otherwise the response tells a manager which asset ids exist at other sites.
    mocks.equipmentFindFirst.mockResolvedValue(null)

    const response = await list.GET(new Request('http://localhost'), params('equip-elsewhere'))
    expect((response as { status: number }).status).toBe(404)
    expect(await (response as { json: () => Promise<{ error: string }> }).json()).toEqual({
      error: 'Equipment not found',
    })
  })

  it('requires a photo to belong to BOTH the item and the caller site before deleting', async () => {
    await detail.DELETE(new Request('http://localhost'), params('equip-1', 'photo-1'))

    const where = mocks.photoFindFirst.mock.calls[0][0].where
    expect(where.AND).toContainEqual({ id: 'photo-1' })
    expect(where.AND).toContainEqual({ equipmentId: 'equip-1' })
    expect(where.AND).toContainEqual({ equipment: { siteId: MAPLE } })
  })

  it('scopes the image read the same way', async () => {
    await image.GET(new Request('http://localhost'), params('equip-1', 'photo-1'))

    const where = mocks.photoFindFirst.mock.calls[0][0].where
    expect(where.AND).toContainEqual({ equipment: { siteId: MAPLE } })
  })

  it('refuses to delete a photo that is not the caller to delete', async () => {
    mocks.photoFindFirst.mockResolvedValue(null)

    const response = await detail.DELETE(new Request('http://localhost'), params('equip-1', 'other'))
    expect((response as { status: number }).status).toBe(404)
    expect(mocks.photoDelete).not.toHaveBeenCalled()
    expect(mocks.removePhoto).not.toHaveBeenCalled()
  })
})

describe('what leaves the server', () => {
  it('never sends the filesystem path to a client', async () => {
    await list.GET(new Request('http://localhost'), params('equip-1'))

    const select = mocks.photoFindMany.mock.calls[0][0].select
    expect(select).not.toHaveProperty('imagePath')
    expect(select).toHaveProperty('id', true)
  })

  it('serves the image with a private cache and no sniffing', async () => {
    const response = (await image.GET(
      new Request('http://localhost'),
      params('equip-1', 'photo-1')
    )) as unknown as { headers: Map<string, string> }

    // Site-scoped bytes must never sit in a shared cache.
    expect(response.headers.get('Cache-Control')).toContain('private')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('Content-Type')).toBe('image/webp')
  })

  it('reports a missing file as gone rather than as a server error', async () => {
    mocks.readPhoto.mockRejectedValue(new Error('ENOENT'))

    const response = await image.GET(new Request('http://localhost'), params('equip-1', 'photo-1'))
    expect((response as { status: number }).status).toBe(404)
  })
})

describe('uploading', () => {
  it('refuses a request with no file', async () => {
    const response = await list.POST(upload(), params('equip-1'))
    expect((response as { status: number }).status).toBe(400)
    expect(mocks.storePhoto).not.toHaveBeenCalled()
  })

  it('reports a rejected photo in words the uploader can act on', async () => {
    const { EquipmentPhotoError } = await vi.importActual<
      typeof import('@/lib/equipment-photos')
    >('@/lib/equipment-photos')
    mocks.processPhoto.mockRejectedValue(new EquipmentPhotoError('That file is not a photo we can read.'))

    const response = await list.POST(
      upload(new File(['x'], 'p.jpg', { type: 'image/jpeg' })),
      params('equip-1')
    )

    expect((response as { status: number }).status).toBe(400)
    expect(await (response as { json: () => Promise<{ error: string }> }).json()).toEqual({
      error: 'That file is not a photo we can read.',
    })
    expect(mocks.storePhoto).not.toHaveBeenCalled()
  })

  it('holds the per-item limit', async () => {
    mocks.photoCount.mockResolvedValue(4)

    const response = await list.POST(
      upload(new File(['x'], 'p.jpg', { type: 'image/jpeg' })),
      params('equip-1')
    )

    expect((response as { status: number }).status).toBe(409)
    expect(mocks.processPhoto).not.toHaveBeenCalled()
  })

  it('trims a caption to something a label can hold', async () => {
    await list.POST(
      upload(new File(['x'], 'p.jpg', { type: 'image/jpeg' }), 'x'.repeat(500)),
      params('equip-1')
    )

    expect(mocks.photoCreate.mock.calls[0][0].data.caption).toHaveLength(120)
  })

  it('removes the stored file when the row fails to write', async () => {
    // Otherwise the data volume accumulates images nothing references and
    // nothing can ever delete.
    mocks.photoCreate.mockRejectedValue(new Error('db down'))

    await expect(
      list.POST(upload(new File(['x'], 'p.jpg', { type: 'image/jpeg' })), params('equip-1'))
    ).rejects.toThrow('db down')

    expect(mocks.removePhoto).toHaveBeenCalledWith('/data/equipment-photos/equip-1/a.webp')
  })

  it('attributes the upload to whoever made it', async () => {
    await list.POST(upload(new File(['x'], 'p.jpg', { type: 'image/jpeg' })), params('equip-1'))
    expect(mocks.photoCreate.mock.calls[0][0].data.uploadedById).toBe('u1')
  })
})

describe('deleting', () => {
  it('removes the row before the file', async () => {
    // The database is authoritative: an orphaned file is untidy, an orphaned row
    // is a broken image in the UI.
    const order: string[] = []
    mocks.photoDelete.mockImplementation(async () => {
      order.push('row')
      return {}
    })
    mocks.removePhoto.mockImplementation(async () => {
      order.push('file')
    })

    await detail.DELETE(new Request('http://localhost'), params('equip-1', 'photo-1'))
    expect(order).toEqual(['row', 'file'])
  })
})
