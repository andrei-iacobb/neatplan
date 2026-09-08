import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@/generated/prisma/client'
import type { FloorPlanRegionInput } from '@/lib/floor-plan-validation'

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  siteFindFirst: vi.fn(),
  roomCount: vi.fn(),
  deleteRegions: vi.fn(),
  createRegions: vi.fn(),
  transaction: vi.fn(),
  processFile: vi.fn<typeof import('@/lib/floor-plan-images').processFloorPlanFile>(),
  storeImage: vi.fn(),
  readImage: vi.fn(),
  removeImage: vi.fn(),
  removeDirectory: vi.fn(),
}))

vi.mock('next-auth/next', () => ({ getServerSession: mocks.getServerSession }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/db', () => ({
  prisma: {
    floorPlan: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
      create: mocks.create,
      updateMany: mocks.updateMany,
    },
    site: { findFirst: mocks.siteFindFirst },
    room: { count: mocks.roomCount },
    $transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/floor-plan-images', () => ({
  FloorPlanImageError: class FloorPlanImageError extends Error {},
  processFloorPlanFile: mocks.processFile,
  storeFloorPlanImage: mocks.storeImage,
  readFloorPlanImage: mocks.readImage,
  removeFloorPlanImage: mocks.removeImage,
  removeFloorPlanDirectory: mocks.removeDirectory,
}))

import { GET as listPlans, POST as uploadPlan } from '@/app/api/floor-plans/route'
import { PATCH as publishPlan } from '@/app/api/floor-plans/[id]/route'
import { GET as getImage, PUT as replaceImage } from '@/app/api/floor-plans/[id]/image/route'
import { PUT as saveRegions } from '@/app/api/floor-plans/[id]/regions/route'
import { FloorPlanImageError } from '@/lib/floor-plan-images'

const context = { params: Promise.resolve({ id: 'plan-1' }) }
const oldImagePath = '/data/floor-plans/plan-1/old.png'
const newImagePath = '/data/floor-plans/plan-1/new.png'
const region = {
  label: 'Laundry', roomId: 'room-a', x: 0.1, y: 0.2, width: 0.2, height: 0.3,
} satisfies FloorPlanRegionInput
const transactionClient = {
  room: { count: mocks.roomCount },
  floorPlan: {
    updateMany: mocks.updateMany,
    findUniqueOrThrow: mocks.findUniqueOrThrow,
  },
  floorPlanRegion: {
    deleteMany: mocks.deleteRegions,
    createMany: mocks.createRegions,
  },
}

function signIn(role = 'HEAD_OF_HOUSEKEEPING', siteId: string | null = 'site-a') {
  mocks.getServerSession.mockResolvedValue({ user: { id: 'user-1', role, siteId } })
}

function jsonRequest(method: string, body: unknown) {
  return new Request('http://localhost/api/floor-plans/plan-1', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function imageRequest(method = 'PUT', revision = 1, siteId = 'site-a') {
  const body = new FormData()
  body.set('name', 'Ground floor')
  body.set('floor', 'Ground')
  body.set('siteId', siteId)
  body.set('revision', String(revision))
  body.set('file', new File(['test image bytes'], 'floor.png', { type: 'image/png' }))
  return new Request('http://localhost/api/floor-plans/plan-1/image', { method, body })
}

beforeEach(() => {
  vi.resetAllMocks()
  signIn()
  mocks.findUnique.mockResolvedValue({
    id: 'plan-1', siteId: 'site-a', revision: 1, isPublished: false,
    imagePath: oldImagePath, imageMimeType: 'image/png', regions: [{ roomId: 'room-a' }],
  })
  mocks.findUniqueOrThrow.mockResolvedValue({ id: 'plan-1', revision: 2, isPublished: false })
  mocks.findMany.mockResolvedValue([])
  mocks.siteFindFirst.mockResolvedValue({ id: 'site-a' })
  mocks.create.mockResolvedValue({ id: 'plan-1', revision: 1 })
  mocks.updateMany.mockResolvedValue({ count: 1 })
  mocks.roomCount.mockResolvedValue(1)
  mocks.processFile.mockResolvedValue({
    bytes: Buffer.from('processed image'), mimeType: 'image/png',
    width: 800, height: 600, sourceFileName: 'floor.png',
  })
  mocks.storeImage.mockResolvedValue(newImagePath)
  mocks.readImage.mockResolvedValue(Buffer.from('stored image'))
  mocks.transaction.mockImplementation(
    (callback: (client: typeof transactionClient) => Promise<unknown>) => callback(transactionClient)
  )
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('floor plan authorization', () => {
  const managementOperations = [
    { name: 'list', invoke: () => listPlans(new Request('http://localhost/api/floor-plans')) },
    { name: 'upload', invoke: () => uploadPlan(imageRequest('POST')) },
    { name: 'publish', invoke: () => publishPlan(jsonRequest('PATCH', { action: 'publish', revision: 1 }), context) },
    { name: 'replace image', invoke: () => replaceImage(imageRequest(), context) },
    { name: 'save regions', invoke: () => saveRegions(jsonRequest('PUT', { revision: 1, regions: [region] }), context) },
  ]

  it.each(managementOperations)('rejects an anonymous $name request before any persistence access', async ({ invoke }) => {
    mocks.getServerSession.mockResolvedValue(null)

    expect((await invoke()).status).toBe(401)
    expect(mocks.findMany).not.toHaveBeenCalled()
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.siteFindFirst).not.toHaveBeenCalled()
    expect(mocks.processFile).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it.each(managementOperations)('rejects a cleaner attempting to $name', async ({ invoke }) => {
    signIn('CLEANER')

    expect((await invoke()).status).toBe(403)
    expect(mocks.findMany).not.toHaveBeenCalled()
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.siteFindFirst).not.toHaveBeenCalled()
    expect(mocks.processFile).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('keeps a forged list filter restricted to the caller site', async () => {
    const response = await listPlans(new Request('http://localhost/api/floor-plans?site=site-b'))

    expect(response.status).toBe(200)
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ siteId: 'site-a' }, { siteId: 'site-a' }] },
    }))
  })

  it.each(managementOperations.slice(2))('hides another site plan when attempting to $name', async ({ invoke }) => {
    mocks.findUnique.mockResolvedValue({ id: 'plan-1', siteId: 'site-b', revision: 1 })

    const response = await invoke()

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Floor plan not found.' })
    expect(mocks.processFile).not.toHaveBeenCalled()
    expect(mocks.updateMany).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})

describe('floor plan upload', () => {
  it.each(['MANAGER', 'HEAD_OF_HOUSEKEEPING'])('allows %s upload to their own site despite a forged siteId', async (role) => {
    signIn(role)
    mocks.siteFindFirst.mockImplementation((query: Prisma.SiteFindFirstArgs) => {
      // Prisma rejects scalar fields that Site does not have, even when a spread passes TypeScript.
      if (query.where && 'siteId' in query.where) throw new Error('Unknown argument siteId')
      return Promise.resolve(query.where?.id === 'site-a' ? { id: 'site-a' } : null)
    })

    const response = await uploadPlan(imageRequest('POST', 1, 'site-b'))

    expect(response.status).toBe(201)
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ siteId: 'site-a', createdById: 'user-1' }),
    }))
  })

  it('rejects an unassigned site manager before processing or storing the file', async () => {
    signIn('MANAGER', null)

    expect((await uploadPlan(imageRequest('POST', 1, 'site-b'))).status).toBe(400)
    expect(mocks.siteFindFirst).not.toHaveBeenCalled()
    expect(mocks.processFile).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('rejects invalid image content without leaving a stored image or plan', async () => {
    mocks.processFile.mockRejectedValue(new FloorPlanImageError('The file content does not match its declared format.'))

    const response = await uploadPlan(imageRequest('POST'))

    expect(response.status).toBe(400)
    expect(mocks.storeImage).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('removes newly stored bytes when a duplicate floor loses the database insert race', async () => {
    mocks.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Duplicate floor', {
      code: 'P2002', clientVersion: '7.9.1',
    }))

    const response = await uploadPlan(imageRequest('POST'))

    expect(response.status).toBe(409)
    expect(mocks.removeDirectory).toHaveBeenCalledExactlyOnceWith(mocks.storeImage.mock.calls[0][0])
  })
})

describe('floor plan image access', () => {
  it('requires a session even when the caller knows the image URL', async () => {
    mocks.getServerSession.mockResolvedValue(null)

    expect((await getImage(new Request('http://localhost'), context)).status).toBe(401)
    expect(mocks.findUnique).not.toHaveBeenCalled()
    expect(mocks.readImage).not.toHaveBeenCalled()
  })

  it('hides an unpublished plan from a cleaner at the same site', async () => {
    signIn('CLEANER')

    expect((await getImage(new Request('http://localhost'), context)).status).toBe(404)
    expect(mocks.readImage).not.toHaveBeenCalled()
  })

  it('hides a published plan belonging to another site', async () => {
    signIn('CLEANER')
    mocks.findUnique.mockResolvedValue({ siteId: 'site-b', isPublished: true, imagePath: oldImagePath })

    expect((await getImage(new Request('http://localhost'), context)).status).toBe(404)
    expect(mocks.readImage).not.toHaveBeenCalled()
  })

  it('serves a published image to its site cleaner with private, non-cacheable headers', async () => {
    signIn('CLEANER')
    mocks.findUnique.mockResolvedValue({
      siteId: 'site-a', isPublished: true, imagePath: oldImagePath, imageMimeType: 'image/png',
    })

    const response = await getImage(new Request('http://localhost'), context)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('stored image')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('content-type')).toBe('image/png')
  })
})

describe('floor plan publication concurrency', () => {
  it('rejects an already stale revision without changing publication', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'plan-1', siteId: 'site-a', revision: 2 })

    const response = await publishPlan(jsonRequest('PATCH', { action: 'publish', revision: 1 }), context)

    expect(response.status).toBe(409)
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })

  it('returns a conflict if a concurrent edit wins after the plan is read', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 })

    const response = await publishPlan(jsonRequest('PATCH', { action: 'publish', revision: 1 }), context)

    expect(response.status).toBe(409)
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'plan-1', revision: 1 },
    }))
    expect(mocks.findUniqueOrThrow).not.toHaveBeenCalled()
  })

  it('does not publish a plan containing an unlinked region', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'plan-1', siteId: 'site-a', revision: 1, regions: [{ roomId: null }],
    })

    const response = await publishPlan(jsonRequest('PATCH', { action: 'publish', revision: 1 }), context)

    expect(response.status).toBe(422)
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })
})

describe('floor plan image replacement failures', () => {
  it('unpublishes a replaced image and removes the superseded bytes', async () => {
    const response = await replaceImage(imageRequest(), context)

    expect(response.status).toBe(200)
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        imagePath: newImagePath, isPublished: false, publishedAt: null, revision: { increment: 1 },
      }),
    }))
    expect(mocks.removeImage).toHaveBeenCalledExactlyOnceWith(oldImagePath)
    expect(await response.json()).toMatchObject({
      revision: 2, isPublished: false, imageUrl: '/api/floor-plans/plan-1/image?v=2',
    })
  })

  it('rejects a stale image replacement before processing the upload', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'plan-1', siteId: 'site-a', revision: 2 })

    expect((await replaceImage(imageRequest(), context)).status).toBe(409)
    expect(mocks.processFile).not.toHaveBeenCalled()
    expect(mocks.storeImage).not.toHaveBeenCalled()
  })

  it('deletes only the losing upload when another editor wins the revision race', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 })

    const response = await replaceImage(imageRequest(), context)

    expect(response.status).toBe(409)
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'plan-1', revision: 1 },
    }))
    expect(mocks.removeImage).toHaveBeenCalledExactlyOnceWith(newImagePath)
    expect(mocks.findUniqueOrThrow).not.toHaveBeenCalled()
  })

  it('keeps the old image if persisting the replacement fails', async () => {
    mocks.updateMany.mockRejectedValue(new Error('Database unavailable'))

    expect((await replaceImage(imageRequest(), context)).status).toBe(500)
    expect(mocks.removeImage).toHaveBeenCalledExactlyOnceWith(newImagePath)
  })

  it('keeps the committed replacement when reading the response record fails', async () => {
    mocks.findUniqueOrThrow.mockRejectedValue(new Error('Database connection lost after commit'))

    expect((await replaceImage(imageRequest(), context)).status).toBe(500)
    expect(mocks.removeImage).toHaveBeenCalledWith(oldImagePath)
    expect(mocks.removeImage).not.toHaveBeenCalledWith(newImagePath)
  })
})

describe('floor plan region integrity', () => {
  it('unpublishes a plan when its last region is removed', async () => {
    mocks.roomCount.mockResolvedValue(0)

    const response = await saveRegions(jsonRequest('PUT', { revision: 1, regions: [] }), context)

    expect(response.status).toBe(200)
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        isPublished: false, publishedAt: null, revision: { increment: 1 },
      }),
    }))
    expect(mocks.deleteRegions).toHaveBeenCalledExactlyOnceWith({ where: { floorPlanId: 'plan-1' } })
    expect(mocks.createRegions).not.toHaveBeenCalled()
  })

  it('rejects a linked room from another site before deleting any existing regions', async () => {
    mocks.roomCount.mockResolvedValue(0)

    const response = await saveRegions(jsonRequest('PUT', {
      revision: 1, regions: [{ ...region, roomId: 'room-other-site' }],
    }), context)

    expect(response.status).toBe(400)
    expect(mocks.roomCount).toHaveBeenCalledWith({
      where: { id: { in: ['room-other-site'] }, siteId: 'site-a' },
    })
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    expect(mocks.updateMany).not.toHaveBeenCalled()
    expect(mocks.deleteRegions).not.toHaveBeenCalled()
  })

  it('preserves existing regions when a concurrent editor has already claimed the revision', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 })

    const response = await saveRegions(jsonRequest('PUT', { revision: 1, regions: [region] }), context)

    expect(response.status).toBe(409)
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'plan-1', revision: 1 },
    }))
    expect(mocks.deleteRegions).not.toHaveBeenCalled()
    expect(mocks.createRegions).not.toHaveBeenCalled()
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
  })

  it('retries a rolled-back serialization failure without relaxing the submitted revision', async () => {
    mocks.transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Write conflict', {
      code: 'P2034', clientVersion: '7.9.1',
    }))

    const response = await saveRegions(jsonRequest('PUT', { revision: 1, regions: [region] }), context)

    expect(response.status).toBe(200)
    expect(mocks.transaction).toHaveBeenCalledTimes(2)
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'plan-1', revision: 1 } }))
    expect(mocks.createRegions).toHaveBeenCalledTimes(1)
  })

  it('rechecks room ownership after a rolled-back save instead of linking a transferred room', async () => {
    mocks.roomCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0)
    mocks.updateMany.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Write conflict', {
      code: 'P2034', clientVersion: '7.9.1',
    }))

    const response = await saveRegions(jsonRequest('PUT', { revision: 1, regions: [region] }), context)

    expect(response.status).toBe(400)
    expect(mocks.transaction).toHaveBeenCalledTimes(2)
    expect(mocks.roomCount).toHaveBeenCalledTimes(2)
    expect(mocks.updateMany).toHaveBeenCalledTimes(1)
    expect(mocks.deleteRegions).not.toHaveBeenCalled()
    expect(mocks.createRegions).not.toHaveBeenCalled()
  })

  it('returns a reload conflict after three aborted serializable saves', async () => {
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Write conflict', {
      code: 'P2034', clientVersion: '7.9.1',
    }))

    const response = await saveRegions(jsonRequest('PUT', { revision: 1, regions: [region] }), context)

    expect(response.status).toBe(409)
    expect(mocks.transaction).toHaveBeenCalledTimes(3)
    expect(await response.json()).toEqual({
      error: 'This plan changed in another session. Reload it before saving.',
    })
  })
})
