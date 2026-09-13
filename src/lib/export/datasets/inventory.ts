import { prisma } from '@/lib/db'
import { siteScopeWhere, readSiteWhere } from '@/lib/authz'
import { canAccessAllSites } from '@/lib/roles'
import { RoomType } from '@/generated/prisma/enums'
import { formatDate, formatDueLabel, humanizeEnum } from '../format'
import {
  buildFilterChips,
  resolveSiteContext,
  searchTerm,
} from '../filters'
import type { DatasetDefinition } from '../types'

type RoomRow = {
  siteName: string
  name: string
  floor: string | null
  type: string
  description: string | null
  scheduleCount: number
  taskCount: number
  nextDue: Date | null
  overdueCount: number
}

export const roomsDataset: DatasetDefinition<RoomRow> = {
  title: 'Room inventory',
  slug: 'rooms',
  cap: 5_000,
  columns: [
    { key: 'site', header: 'Site', value: (r) => r.siteName, width: 2 },
    { key: 'name', header: 'Room', value: (r) => r.name, width: 3 },
    { key: 'floor', header: 'Floor', value: (r) => r.floor, width: 2 },
    { key: 'type', header: 'Type', value: (r) => humanizeEnum(r.type), width: 2 },
    { key: 'schedules', header: 'Schedules', value: (r) => r.scheduleCount, align: 'right', width: 1 },
    { key: 'tasks', header: 'Tasks', value: (r) => r.taskCount, align: 'right', width: 1 },
    { key: 'nextDue', header: 'Next due', value: (r) => formatDate(r.nextDue), width: 2 },
    { key: 'dueIn', header: 'Due', value: (r) => formatDueLabel(r.nextDue), width: 2 },
    { key: 'overdue', header: 'Overdue', value: (r) => r.overdueCount, align: 'right', width: 1 },
    { key: 'description', header: 'Description', value: (r) => r.description, wrap: true, width: 3 },
  ],
  async load({ user, params }, cap) {
    const site = await resolveSiteContext(user, params)
    const q = searchTerm(params)
    const floor = params.get('floor')?.trim() || undefined

    // Only a real RoomType reaches Prisma. An unrecognised `?type=` is dropped
    // rather than passed through, so a crafted value cannot produce a query error
    // that leaks the schema in a 500.
    const requestedType = params.get('type')?.trim().toUpperCase()
    const type =
      requestedType && requestedType in RoomType
        ? (requestedType as RoomType)
        : undefined

    const where = {
      AND: [
        siteScopeWhere(user),
        readSiteWhere(site.siteId),
        ...(floor ? [{ floor }] : []),
        ...(type ? [{ type }] : []),
        ...(q
          ? [{
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { description: { contains: q, mode: 'insensitive' as const } },
                { floor: { contains: q, mode: 'insensitive' as const } },
              ],
            }]
          : []),
      ],
    }

    const [total, rooms] = await Promise.all([
      prisma.room.count({ where }),
      prisma.room.findMany({
        where,
        // Deterministic: name then id. The list route orders by createdAt desc,
        // which is fine for a screen but makes two exports of unchanged data
        // diff-noisy when rooms share a timestamp.
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: cap,
        select: {
          name: true,
          floor: true,
          type: true,
          description: true,
          site: { select: { name: true } },
          schedules: {
            select: {
              nextDue: true,
              status: true,
              schedule: { select: { _count: { select: { tasks: true } } } },
            },
          },
        },
      }),
    ])

    const rows: RoomRow[] = rooms.map((room) => {
      const dueDates = room.schedules.map((s) => s.nextDue).sort((a, b) => a.getTime() - b.getTime())
      return {
        siteName: room.site?.name ?? '',
        name: room.name,
        floor: room.floor,
        type: room.type,
        description: room.description,
        scheduleCount: room.schedules.length,
        taskCount: room.schedules.reduce((sum, s) => sum + s.schedule._count.tasks, 0),
        nextDue: dueDates[0] ?? null,
        overdueCount: room.schedules.filter((s) => s.status === 'OVERDUE').length,
      }
    })

    return {
      rows,
      total,
      subtitle: site.label,
      filters: buildFilterChips([
        ['Site', site.label],
        ['Floor', floor],
        ['Type', type ? humanizeEnum(type) : undefined],
        ['Search', q],
      ]),
      summary: [
        { label: 'Rooms', value: String(total) },
        { label: 'Schedules', value: String(rows.reduce((n, r) => n + r.scheduleCount, 0)) },
        { label: 'Overdue', value: String(rows.reduce((n, r) => n + r.overdueCount, 0)) },
      ],
    }
  },
}

type EquipmentRow = {
  siteName: string
  name: string
  assetCode: string | null
  type: string
  model: string | null
  serialNumber: string | null
  serviceArea: string | null
  serviceAreaFloor: string | null
  scheduleCount: number
  taskCount: number
  nextDue: Date | null
  overdueCount: number
  description: string | null
}

export const equipmentDataset: DatasetDefinition<EquipmentRow> = {
  title: 'Equipment inventory',
  slug: 'equipment',
  cap: 5_000,
  columns: [
    { key: 'site', header: 'Site', value: (r) => r.siteName, width: 2 },
    { key: 'name', header: 'Equipment', value: (r) => r.name, width: 3 },
    { key: 'assetCode', header: 'Asset code', value: (r) => r.assetCode, width: 2 },
    { key: 'type', header: 'Type', value: (r) => humanizeEnum(r.type), width: 2 },
    { key: 'model', header: 'Model', value: (r) => r.model, width: 2 },
    { key: 'serial', header: 'Serial', value: (r) => r.serialNumber, width: 2 },
    { key: 'serviceArea', header: 'Service area', value: (r) => r.serviceArea, width: 2 },
    { key: 'serviceAreaFloor', header: 'Floor', value: (r) => r.serviceAreaFloor, width: 1 },
    { key: 'schedules', header: 'Schedules', value: (r) => r.scheduleCount, align: 'right', width: 1 },
    { key: 'tasks', header: 'Tasks', value: (r) => r.taskCount, align: 'right', width: 1 },
    { key: 'nextDue', header: 'Next due', value: (r) => formatDate(r.nextDue), width: 2 },
    { key: 'overdue', header: 'Overdue', value: (r) => r.overdueCount, align: 'right', width: 1 },
    { key: 'description', header: 'Description', value: (r) => r.description, wrap: true, width: 3, only: 'csv' },
  ],
  async load({ user, params }, cap) {
    const site = await resolveSiteContext(user, params)
    const q = searchTerm(params)
    const type = params.get('type')?.trim()
    const typeFilter = type && type !== 'all' ? type : undefined

    const where = {
      AND: [
        siteScopeWhere(user),
        readSiteWhere(site.siteId),
        ...(typeFilter ? [{ type: typeFilter }] : []),
        ...(q
          ? [{
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { type: { contains: q, mode: 'insensitive' as const } },
                { model: { contains: q, mode: 'insensitive' as const } },
                { assetCode: { contains: q, mode: 'insensitive' as const } },
                { serviceArea: { name: { contains: q, mode: 'insensitive' as const } } },
              ],
            }]
          : []),
      ],
    }

    const [total, equipment] = await Promise.all([
      prisma.equipment.count({ where }),
      prisma.equipment.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: cap,
        select: {
          name: true,
          assetCode: true,
          type: true,
          model: true,
          serialNumber: true,
          description: true,
          site: { select: { name: true } },
          serviceArea: { select: { name: true, floor: true } },
          schedules: {
            select: {
              nextDue: true,
              status: true,
              schedule: { select: { _count: { select: { tasks: true } } } },
            },
          },
        },
      }),
    ])

    const rows: EquipmentRow[] = equipment.map((item) => {
      const dueDates = item.schedules.map((s) => s.nextDue).sort((a, b) => a.getTime() - b.getTime())
      return {
        siteName: item.site?.name ?? '',
        name: item.name,
        assetCode: item.assetCode,
        type: item.type,
        model: item.model,
        serialNumber: item.serialNumber,
        serviceArea: item.serviceArea?.name ?? null,
        serviceAreaFloor: item.serviceArea?.floor ?? null,
        scheduleCount: item.schedules.length,
        taskCount: item.schedules.reduce((sum, s) => sum + s.schedule._count.tasks, 0),
        nextDue: dueDates[0] ?? null,
        overdueCount: item.schedules.filter((s) => s.status === 'OVERDUE').length,
        description: item.description,
      }
    })

    return {
      rows,
      total,
      subtitle: site.label,
      filters: buildFilterChips([
        ['Site', site.label],
        ['Type', typeFilter ? humanizeEnum(typeFilter) : undefined],
        ['Search', q],
      ]),
      summary: [
        { label: 'Equipment', value: String(total) },
        { label: 'Schedules', value: String(rows.reduce((n, r) => n + r.scheduleCount, 0)) },
        { label: 'Overdue', value: String(rows.reduce((n, r) => n + r.overdueCount, 0)) },
      ],
    }
  },
}

type SiteRow = {
  name: string
  address: string | null
  description: string | null
  rooms: number
  equipment: number
  users: number
  floorPlans: number
}

export const sitesDataset: DatasetDefinition<SiteRow> = {
  title: 'Sites',
  slug: 'sites',
  cap: 1_000,
  columns: [
    { key: 'name', header: 'Site', value: (r) => r.name, width: 3 },
    { key: 'address', header: 'Address', value: (r) => r.address, wrap: true, width: 4 },
    { key: 'rooms', header: 'Rooms', value: (r) => r.rooms, align: 'right', width: 1 },
    { key: 'equipment', header: 'Equipment', value: (r) => r.equipment, align: 'right', width: 1 },
    { key: 'users', header: 'People', value: (r) => r.users, align: 'right', width: 1 },
    { key: 'floorPlans', header: 'Floor plans', value: (r) => r.floorPlans, align: 'right', width: 1 },
    { key: 'description', header: 'Description', value: (r) => r.description, wrap: true, width: 4 },
  ],
  async load({ user }, cap) {
    // A pinned role sees only its own site. Mirrors the inline rule in
    // GET /api/sites rather than inventing a second one.
    const where = canAccessAllSites(user.role)
      ? {}
      : { id: user.siteId ?? '__no_site__' }

    const [total, sites] = await Promise.all([
      prisma.site.count({ where }),
      prisma.site.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: cap,
        select: {
          name: true,
          address: true,
          description: true,
          _count: { select: { rooms: true, equipment: true, users: true, floorPlans: true } },
        },
      }),
    ])

    return {
      rows: sites.map((site) => ({
        name: site.name,
        address: site.address,
        description: site.description,
        rooms: site._count.rooms,
        equipment: site._count.equipment,
        users: site._count.users,
        floorPlans: site._count.floorPlans,
      })),
      total,
      subtitle: canAccessAllSites(user.role) ? 'All sites' : undefined,
      filters: [],
      summary: [{ label: 'Sites', value: String(total) }],
    }
  },
}

type UserRow = {
  name: string | null
  email: string
  role: string
  siteName: string | null
  status: string
}

export const usersDataset: DatasetDefinition<UserRow> = {
  title: 'People',
  slug: 'people',
  cap: 2_000,
  columns: [
    { key: 'name', header: 'Name', value: (r) => r.name, width: 3 },
    { key: 'email', header: 'Email', value: (r) => r.email, width: 4 },
    { key: 'role', header: 'Role', value: (r) => r.role, width: 2 },
    { key: 'site', header: 'Site', value: (r) => r.siteName, width: 2 },
    { key: 'status', header: 'Status', value: (r) => r.status, width: 2 },
  ],
  async load({ user, params }, cap) {
    const site = await resolveSiteContext(user, params)
    const q = searchTerm(params)

    const where = {
      AND: [
        siteScopeWhere(user),
        readSiteWhere(site.siteId),
        // The owner account is hidden from every listing; an export must not be
        // the one place it reappears.
        { isHidden: false },
        ...(q
          ? [{
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { email: { contains: q, mode: 'insensitive' as const } },
              ],
            }]
          : []),
      ],
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: [{ name: 'asc' }, { email: 'asc' }],
        take: cap,
        // Explicit select, never `include`. Password hash, TOTP secret, failed
        // login counters and the settings blob must not be reachable from here.
        select: {
          name: true,
          email: true,
          role: true,
          isBlocked: true,
          site: { select: { name: true } },
        },
      }),
    ])

    const { ROLE_LABELS } = await import('@/lib/roles')

    return {
      rows: users.map((u) => ({
        name: u.name,
        email: u.email,
        role: ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? humanizeEnum(u.role),
        siteName: u.site?.name ?? null,
        status: u.isBlocked ? 'Blocked' : 'Active',
      })),
      total,
      subtitle: site.label,
      filters: buildFilterChips([
        ['Site', site.label],
        ['Search', q],
      ]),
      summary: [{ label: 'People', value: String(total) }],
    }
  },
}

type FloorPlanRow = {
  siteName: string
  name: string
  floor: string
  published: boolean
  revision: number
  mappedRooms: number
  unmappedRegions: number
  updatedAt: Date
}

export const floorPlansDataset: DatasetDefinition<FloorPlanRow> = {
  title: 'Floor plans',
  slug: 'floor-plans',
  cap: 1_000,
  columns: [
    { key: 'site', header: 'Site', value: (r) => r.siteName, width: 2 },
    { key: 'name', header: 'Plan', value: (r) => r.name, width: 3 },
    { key: 'floor', header: 'Floor', value: (r) => r.floor, width: 2 },
    { key: 'published', header: 'Published', value: (r) => r.published, width: 1 },
    { key: 'revision', header: 'Revision', value: (r) => r.revision, align: 'right', width: 1 },
    { key: 'mapped', header: 'Mapped rooms', value: (r) => r.mappedRooms, align: 'right', width: 1 },
    { key: 'unmapped', header: 'Unmapped regions', value: (r) => r.unmappedRegions, align: 'right', width: 1 },
    { key: 'updated', header: 'Updated', value: (r) => formatDate(r.updatedAt), width: 2 },
  ],
  async load({ user, params }, cap) {
    const site = await resolveSiteContext(user, params)

    const where = { AND: [siteScopeWhere(user), readSiteWhere(site.siteId)] }

    const [total, plans] = await Promise.all([
      prisma.floorPlan.count({ where }),
      prisma.floorPlan.findMany({
        where,
        orderBy: [{ floor: 'asc' }, { name: 'asc' }],
        take: cap,
        // `imagePath` is a server filesystem path and is deliberately not selected.
        select: {
          name: true,
          floor: true,
          isPublished: true,
          revision: true,
          updatedAt: true,
          site: { select: { name: true } },
          regions: { select: { roomId: true } },
        },
      }),
    ])

    return {
      rows: plans.map((plan) => ({
        siteName: plan.site?.name ?? '',
        name: plan.name,
        floor: plan.floor,
        published: plan.isPublished,
        revision: plan.revision,
        mappedRooms: plan.regions.filter((r) => r.roomId).length,
        unmappedRegions: plan.regions.filter((r) => !r.roomId).length,
        updatedAt: plan.updatedAt,
      })),
      total,
      subtitle: site.label,
      filters: buildFilterChips([['Site', site.label]]),
      summary: [
        { label: 'Plans', value: String(total) },
        { label: 'Published', value: String(plans.filter((p) => p.isPublished).length) },
      ],
    }
  },
}
