import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { prisma } from '@/lib/db'
import { canAccessSite, getSessionUser } from '@/lib/authz'
import { canUseCleaningPortal } from '@/lib/roles'
import { parseLocationToken } from '@/lib/location-tokens'
import { VerificationMethod } from '@/generated/prisma/enums'
import { ScanOutcome } from '@/components/cleaner/scan-outcome'

export const metadata = {
  title: 'Scanned location',
  robots: { index: false, follow: false },
}

/**
 * How long a check-in stays usable after a scan.
 *
 * Long enough to clean a room without rescanning, short enough that a URL
 * captured from somebody's browser history is not still live tomorrow. It is a
 * convenience window, not a security control - see the note in location-tokens.
 */
const CHECK_IN_MINUTES = 45

/**
 * Where a QR or NFC scan lands.
 *
 * Everything here is deliberately re-derived server side. The token says which
 * room or item it is FOR; it says nothing about who is holding it, so the site
 * check and the role check both run against the session as usual.
 */
export default async function ScanPage({ params }: { params: Promise<{ token: string }> }) {
  await connection()

  const { token } = await params
  const user = await getSessionUser()

  if (!user) {
    // Sign in, then come back to the same label. Scanning while logged out is the
    // normal case on a shared tablet at the start of a shift.
    redirect(`/auth?callbackUrl=${encodeURIComponent(`/c/${encodeURIComponent(token)}`)}`)
  }

  const claims = parseLocationToken(token)
  if (!claims) {
    return <ScanOutcome kind="unreadable" />
  }

  if (claims.kind === 'equipment') {
    const equipment = await prisma.equipment.findUnique({
      where: { id: claims.id },
      select: { id: true, name: true, siteId: true, locationTokenVersion: true },
    })

    // Same answer for "does not exist" and "belongs to a site you cannot see", so
    // a scanner cannot map another site's asset register by trying tokens.
    if (!equipment || !canAccessSite(user, equipment.siteId)) {
      return <ScanOutcome kind="unknown" />
    }

    if (equipment.locationTokenVersion !== claims.version) {
      return <ScanOutcome kind="revoked" name={equipment.name} />
    }

    // Equipment has no check-in record: RoomCheckIn is, as the name says, per
    // room. The scan is a deep link into the item's tasks, which is the useful
    // part anyway.
    redirect(canUseCleaningPortal(user.role) ? `/clean/equipment/${equipment.id}` : `/equipment`)
  }

  const room = await prisma.room.findUnique({
    where: { id: claims.id },
    select: { id: true, name: true, floor: true, siteId: true, locationTokenVersion: true },
  })

  if (!room || !canAccessSite(user, room.siteId)) {
    return <ScanOutcome kind="unknown" />
  }

  if (room.locationTokenVersion !== claims.version) {
    return <ScanOutcome kind="revoked" name={room.name} />
  }

  // A manager scanning a door wants the room's schedule, not a cleaning session.
  if (!canUseCleaningPortal(user.role)) {
    redirect(`/rooms/${room.id}`)
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + CHECK_IN_MINUTES * 60_000)

  /*
   * Reuse a live check-in rather than writing one per scan. A cleaner who scans
   * the same door three times while working should not leave three rows behind,
   * and it means a replayed URL cannot be used to pile up records.
   */
  const existing = await prisma.roomCheckIn.findFirst({
    where: {
      userId: user.id,
      roomId: room.id,
      consumedAt: null,
      expiresAt: { gt: now },
      locationTokenVersion: room.locationTokenVersion,
    },
    orderBy: { checkedInAt: 'desc' },
    select: { id: true },
  })

  const checkIn =
    existing ??
    (await prisma.roomCheckIn.create({
      data: {
        roomId: room.id,
        userId: user.id,
        method: VerificationMethod.QR,
        expiresAt,
        locationTokenVersion: room.locationTokenVersion,
      },
      select: { id: true },
    }))

  redirect(`/clean/${room.id}?checkIn=${checkIn.id}`)
}
