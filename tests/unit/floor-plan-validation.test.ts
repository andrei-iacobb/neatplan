import { describe, expect, it } from 'vitest'
import {
  floorPlanPublishIssue,
  floorPlanRegionSchema,
  saveFloorPlanRegionsSchema,
} from '@/lib/floor-plan-validation'

describe('floor plan region validation', () => {
  const validRegion = {
    label: 'Room 1',
    roomId: 'room-1',
    x: 0.1,
    y: 0.2,
    width: 0.2,
    height: 0.15,
  }

  it('accepts normalized geometry that stays inside the plan', () => {
    expect(floorPlanRegionSchema.safeParse(validRegion).success).toBe(true)
  })

  it('rejects a marker that extends beyond an image edge', () => {
    const result = floorPlanRegionSchema.safeParse({ ...validRegion, x: 0.9, width: 0.2 })
    expect(result.success).toBe(false)
  })

  it('rejects the same room appearing twice on one plan', () => {
    const result = saveFloorPlanRegionsSchema.safeParse({
      revision: 1,
      regions: [validRegion, { ...validRegion, label: 'Duplicate', x: 0.4 }],
    })
    expect(result.success).toBe(false)
  })
})

describe('floor plan publication', () => {
  it('requires at least one marked area', () => {
    expect(floorPlanPublishIssue([])).toMatch(/at least one/i)
  })

  it('blocks publication while a room link is unresolved', () => {
    expect(floorPlanPublishIssue([{ roomId: null }])).toMatch(/link every/i)
  })

  it('allows publication after every marker is linked', () => {
    expect(floorPlanPublishIssue([{ roomId: 'room-1' }, { roomId: 'room-2' }])).toBeNull()
  })
})
