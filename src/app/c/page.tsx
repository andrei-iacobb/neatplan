import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionUser, siteScopeWhere } from '@/lib/authz'
import { locationShortCode } from '@/lib/location-tokens'
import { LocationFinder, type FindableLocation } from '@/components/cleaner/location-finder'

export const metadata = {
  title: 'Find a location',
  robots: { index: false, follow: false },
}

/**
 * The fallback for when scanning is not an option: no camera, permission denied,
 * a scuffed label, or a tablet that simply will not focus.
 *
 * It lists what the signed-in person is already entitled to see and lets them
 * search it by name, floor or the code printed on the label. Nothing here is a
 * shortcut around authorisation - it is the same site scope the rest of the app
 * uses, rendered as a list.
 */
export default async function LocationFinderPage() {
  await connection()

  const user = await getSessionUser()
  if (!user) redirect(`/auth?callbackUrl=${encodeURIComponent('/c')}`)

  const scope = siteScopeWhere(user)

  const [rooms, equipment] = await Promise.all([
    prisma.room.findMany({
      where: scope,
      orderBy: [{ floor: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, floor: true, type: true, locationTokenVersion: true },
    }),
    prisma.equipment.findMany({
      where: scope,
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        assetCode: true,
        locationTokenVersion: true,
        serviceArea: { select: { name: true } },
      },
    }),
  ])

  /*
   * Codes are derived here rather than stored. Two targets sharing one is
   * vanishingly unlikely at eight base32 characters, and if it ever happened the
   * search would simply show both and the reader would pick - which is why this
   * is a picker and not a redirect-on-exact-match.
   */
  const locations: FindableLocation[] = [
    ...rooms.map((room) => ({
      kind: 'room' as const,
      id: room.id,
      name: room.name,
      place: room.floor ?? '',
      code: locationShortCode('room', room.id, room.locationTokenVersion),
      href: `/clean/${room.id}`,
    })),
    ...equipment.map((item) => ({
      kind: 'equipment' as const,
      id: item.id,
      name: item.name,
      place: item.serviceArea?.name ?? item.assetCode ?? '',
      code: locationShortCode('equipment', item.id, item.locationTokenVersion),
      href: `/clean/equipment/${item.id}`,
    })),
  ]

  return <LocationFinder locations={locations} />
}
