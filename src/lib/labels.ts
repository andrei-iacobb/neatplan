import 'server-only'

import { prisma } from '@/lib/db'
import { siteScopeWhere, readSiteWhere, type SessionUser } from '@/lib/authz'
import {
  locationShortCode,
  locationTokenUrl,
  mintLocationToken,
  type LocationKind,
} from '@/lib/location-tokens'
import { qrPathForUrl, type QrPath } from '@/lib/qr'

/**
 * Building the printable label set for rooms and equipment.
 *
 * A label carries four things: the QR, the name a human reads from across a
 * corridor, the short code they type when the camera will not play, and the site
 * it belongs to. Everything on it is derived - nothing here is stored, so
 * reprinting a lost label is just printing it again.
 */

export interface LabelModel {
  kind: LocationKind
  id: string
  /** Room or equipment name, the thing the label is read by. */
  name: string
  /** Floor for a room, service area for equipment. Empty when neither applies. */
  place: string
  siteName: string
  /** Asset code for equipment; room type for a room. Secondary identification. */
  detail: string
  url: string
  shortCode: string
  qr: QrPath
  version: number
}

/** A4 at 8 labels per sheet. Beyond this the QR modules get too fine to scan. */
export const LABELS_PER_SHEET = 8

/**
 * Hard ceiling on one print job. Sixty-one rooms is eight sheets; a request for
 * thousands is a mistake or a probe, and rendering it would tie up the server
 * building QR matrices nobody asked for.
 */
export const MAX_LABELS = 240

export interface LabelRequest {
  user: SessionUser
  /** Restrict to one kind, or leave undefined for both. */
  kind?: LocationKind
  siteId: string | null
  /** Specific targets. Empty means every target in scope. */
  ids?: string[]
  floor?: string
  /** Absolute origin the QR should point at. */
  origin: string
}

export interface LabelSet {
  labels: LabelModel[]
  /** Matching targets before the cap, so the sheet can say what it left out. */
  total: number
  siteLabel: string
}

export async function buildLabelSet(request: LabelRequest): Promise<LabelSet> {
  const { user, siteId, ids, floor, origin } = request
  const wantRooms = request.kind !== 'equipment'
  const wantEquipment = request.kind !== 'room'

  const idFilter = ids && ids.length > 0 ? { id: { in: ids } } : {}

  const [rooms, roomTotal, equipment, equipmentTotal] = await Promise.all([
    wantRooms
      ? prisma.room.findMany({
          where: {
            AND: [
              siteScopeWhere(user),
              readSiteWhere(siteId),
              idFilter,
              ...(floor ? [{ floor }] : []),
            ],
          },
          orderBy: [{ floor: 'asc' }, { name: 'asc' }, { id: 'asc' }],
          take: MAX_LABELS,
          select: {
            id: true,
            name: true,
            floor: true,
            type: true,
            locationTokenVersion: true,
            site: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    wantRooms
      ? prisma.room.count({
          where: {
            AND: [siteScopeWhere(user), readSiteWhere(siteId), idFilter, ...(floor ? [{ floor }] : [])],
          },
        })
      : Promise.resolve(0),
    wantEquipment
      ? prisma.equipment.findMany({
          where: { AND: [siteScopeWhere(user), readSiteWhere(siteId), idFilter] },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          take: MAX_LABELS,
          select: {
            id: true,
            name: true,
            assetCode: true,
            type: true,
            locationTokenVersion: true,
            site: { select: { name: true } },
            serviceArea: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    wantEquipment
      ? prisma.equipment.count({ where: { AND: [siteScopeWhere(user), readSiteWhere(siteId), idFilter] } })
      : Promise.resolve(0),
  ])

  const humanize = (value: string) => {
    const words = value.replace(/_/g, ' ').toLowerCase().trim()
    return words.charAt(0).toUpperCase() + words.slice(1)
  }

  const toLabel = (
    kind: LocationKind,
    target: { id: string; name: string; locationTokenVersion: number },
    place: string,
    detail: string,
    siteName: string
  ): LabelModel => {
    const token = mintLocationToken(kind, target.id, target.locationTokenVersion)
    const url = locationTokenUrl(origin, token)
    return {
      kind,
      id: target.id,
      name: target.name,
      place,
      detail,
      siteName,
      url,
      shortCode: locationShortCode(kind, target.id, target.locationTokenVersion),
      qr: qrPathForUrl(url),
      version: target.locationTokenVersion,
    }
  }

  /*
   * Share the cap between the two kinds rather than concatenating and slicing.
   * A naive slice puts rooms first, so a site with more rooms than the cap would
   * print zero equipment labels while the notice said "240 of 260" - which reads
   * as "some were cut" rather than "one whole category is missing".
   *
   * Each kind gets at least a half share, and whatever the smaller one does not
   * use goes to the larger.
   */
  const fairShare = Math.floor(MAX_LABELS / 2)
  const roomQuota = Math.min(rooms.length, Math.max(fairShare, MAX_LABELS - equipment.length))
  const equipmentQuota = Math.min(equipment.length, MAX_LABELS - roomQuota)

  const labels: LabelModel[] = [
    ...rooms
      .slice(0, roomQuota)
      .map((room) =>
        toLabel('room', room, room.floor ?? '', humanize(room.type), room.site?.name ?? '')
      ),
    ...equipment
      .slice(0, equipmentQuota)
      .map((item) =>
        toLabel(
          'equipment',
          item,
          item.serviceArea?.name ?? '',
          item.assetCode ?? humanize(item.type),
          item.site?.name ?? ''
        )
      ),
  ]

  const site = siteId
    ? await prisma.site.findUnique({ where: { id: siteId }, select: { name: true } })
    : null

  return {
    labels,
    total: roomTotal + equipmentTotal,
    siteLabel: site?.name ?? 'All sites',
  }
}
