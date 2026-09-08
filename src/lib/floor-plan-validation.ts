import * as z from 'zod'

const normalizedCoordinate = z.number().finite().min(0).max(1)
const normalizedSize = z.number().finite().positive().max(1)

export const floorPlanRegionSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().trim().min(1, 'Every region needs a label').max(100),
  roomId: z.string().min(1).nullable(),
  x: normalizedCoordinate,
  y: normalizedCoordinate,
  width: normalizedSize,
  height: normalizedSize,
}).superRefine((region, context) => {
  if (region.x + region.width > 1) {
    context.addIssue({ code: 'custom', path: ['width'], message: 'Region extends beyond the right edge' })
  }
  if (region.y + region.height > 1) {
    context.addIssue({ code: 'custom', path: ['height'], message: 'Region extends beyond the bottom edge' })
  }
})

export const saveFloorPlanRegionsSchema = z.object({
  revision: z.number().int().positive(),
  regions: z.array(floorPlanRegionSchema).max(300, 'A floor plan can contain at most 300 regions'),
}).superRefine(({ regions }, context) => {
  const linkedRoomIds = new Set<string>()
  regions.forEach((region, index) => {
    if (!region.roomId) return
    if (linkedRoomIds.has(region.roomId)) {
      context.addIssue({
        code: 'custom',
        path: ['regions', index, 'roomId'],
        message: 'Each room can appear only once on a floor plan',
      })
    }
    linkedRoomIds.add(region.roomId)
  })
})

export const floorPlanUploadFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Plan name is required').max(100),
  floor: z.string().trim().min(1, 'Floor is required').max(100),
  siteId: z.string().trim().min(1).optional(),
})

export const floorPlanPublishSchema = z.object({
  action: z.enum(['publish', 'unpublish']),
  revision: z.number().int().positive(),
})

export type FloorPlanRegionInput = z.infer<typeof floorPlanRegionSchema>

export function floorPlanPublishIssue(regions: Array<{ roomId: string | null }>): string | null {
  if (regions.length === 0) return 'Add at least one room or service area before publishing this plan.'
  if (regions.some((region) => !region.roomId)) {
    return 'Link every marked area to a room or service area before publishing this plan.'
  }
  return null
}
