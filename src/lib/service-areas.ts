import 'server-only'

import { prisma } from '@/lib/db'

export function normalizeServiceAreaId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length > 0 && normalized.length <= 100 ? normalized : undefined
}

export async function findServiceAreaAtSite(serviceAreaId: string, siteId: string) {
  return prisma.room.findFirst({
    where: {
      id: serviceAreaId,
      siteId,
      type: 'SERVICE_AREA',
    },
    select: {
      id: true,
      name: true,
      floor: true,
      siteId: true,
    },
  })
}
