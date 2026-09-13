import { prisma } from '@/lib/db'
import { siteScopeWhere, nestedSiteScopeWhere, nestedReadSiteWhere } from '@/lib/authz'
import type { SessionUser } from '@/lib/authz'
import { ScheduleStatus } from '@/generated/prisma/enums'
import { formatDate, formatDateTime, formatDueLabel, humanizeEnum } from '../format'
import {
  buildFilterChips,
  dateWindowWhere,
  describeDateWindow,
  parseDateWindow,
  resolveSiteContext,
  searchTerm,
} from '../filters'
import type { DatasetDefinition } from '../types'

type CompletionRow = {
  completedAt: Date
  kind: 'Room' | 'Equipment'
  itemName: string
  floor: string | null
  itemType: string | null
  scheduleTitle: string
  frequency: string | null
  completedBy: string
  tasksDone: number
  totalTasks: number
  verification: string
  signedName: string | null
  notes: string | null
}

function completionPercent(done: number, total: number): string {
  if (total <= 0) return ''
  return `${Math.round((done / total) * 100)}%`
}

export const completionsDataset: DatasetDefinition<CompletionRow> = {
  title: 'Completion history',
  slug: 'completions',
  cap: 20_000,
  columns: [
    { key: 'date', header: 'Completed', value: (r) => formatDateTime(r.completedAt), width: 3 },
    { key: 'kind', header: 'Kind', value: (r) => r.kind, width: 1 },
    { key: 'item', header: 'Room / equipment', value: (r) => r.itemName, width: 3 },
    { key: 'floor', header: 'Floor', value: (r) => r.floor, width: 1 },
    { key: 'itemType', header: 'Type', value: (r) => humanizeEnum(r.itemType), width: 2 },
    { key: 'schedule', header: 'Schedule', value: (r) => r.scheduleTitle, width: 3 },
    { key: 'frequency', header: 'Frequency', value: (r) => humanizeEnum(r.frequency), width: 2 },
    { key: 'by', header: 'Completed by', value: (r) => r.completedBy, width: 3 },
    { key: 'done', header: 'Done', value: (r) => r.tasksDone, align: 'right', width: 1 },
    { key: 'total', header: 'Of', value: (r) => r.totalTasks, align: 'right', width: 1 },
    { key: 'pct', header: '%', value: (r) => completionPercent(r.tasksDone, r.totalTasks), align: 'right', width: 1 },
    { key: 'verification', header: 'Verified by', value: (r) => humanizeEnum(r.verification), width: 2 },
    // The drawn signature image itself is never exported. The printed name is
    // the auditable part; the bitmap is not, and embedding data URLs in a CSV
    // would be both useless and a needless copy of a personal mark.
    { key: 'signedName', header: 'Signed', value: (r) => r.signedName, width: 2 },
    { key: 'notes', header: 'Notes', value: (r) => r.notes, wrap: true, width: 4 },
  ],
  async load({ user, params }, cap) {
    const site = await resolveSiteContext(user, params)
    const window = parseDateWindow(params)
    const completedAt = dateWindowWhere(window)
    const roomId = params.get('roomId')?.trim() || undefined
    const userId = params.get('userId')?.trim() || undefined
    const q = searchTerm(params)

    // A completion log reaches its site two relations deep
    // (log -> roomSchedule -> room -> siteId), so nestedSiteScopeWhere - which
    // only walks one level - cannot express it. Build the fragment explicitly.
    const roomWhere = {
      AND: [
        { roomSchedule: { room: siteScopeWhere(user) } },
        ...(completedAt ? [{ completedAt }] : []),
        ...(roomId ? [{ roomSchedule: { roomId } }] : []),
        ...(userId ? [{ completedByUserId: userId }] : []),
        ...(site.siteId ? [{ roomSchedule: { room: { siteId: site.siteId } } }] : []),
        ...(q
          ? [{
              OR: [
                { roomName: { contains: q, mode: 'insensitive' as const } },
                { scheduleTitle: { contains: q, mode: 'insensitive' as const } },
                { roomSchedule: { room: { name: { contains: q, mode: 'insensitive' as const } } } },
                { roomSchedule: { schedule: { title: { contains: q, mode: 'insensitive' as const } } } },
                { completedBy: { name: { contains: q, mode: 'insensitive' as const } } },
              ],
            }]
          : []),
      ],
    }

    // Equipment completions carry no room and no room-level user filter, so the
    // two filters that only make sense for rooms exclude the source entirely -
    // the same rule GET /api/admin/completion-history uses.
    const equipmentApplies = !roomId
    const equipWhere = {
      AND: [
        { equipmentSchedule: { equipment: siteScopeWhere(user) } },
        ...(completedAt ? [{ completedAt }] : []),
        ...(userId ? [{ completedByUserId: userId }] : []),
        ...(site.siteId ? [{ equipmentSchedule: { equipment: { siteId: site.siteId } } }] : []),
        ...(q
          ? [{
              OR: [
                { equipmentName: { contains: q, mode: 'insensitive' as const } },
                { scheduleTitle: { contains: q, mode: 'insensitive' as const } },
                { equipmentSchedule: { equipment: { name: { contains: q, mode: 'insensitive' as const } } } },
                { equipmentSchedule: { schedule: { title: { contains: q, mode: 'insensitive' as const } } } },
                { completedBy: { name: { contains: q, mode: 'insensitive' as const } } },
              ],
            }]
          : []),
      ],
    }

    // Each source is capped independently, then merged and re-cut. The merged
    // top `cap` rows can only come from the top `cap` of either source, so this
    // is exact rather than approximate.
    const [roomTotal, roomLogs, equipTotal, equipLogs] = await Promise.all([
      prisma.roomScheduleCompletionLog.count({ where: roomWhere }),
      prisma.roomScheduleCompletionLog.findMany({
        where: roomWhere,
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        take: cap,
        select: {
          completedAt: true,
          completedTasks: true,
          notes: true,
          roomName: true,
          scheduleTitle: true,
          verificationMethod: true,
          signedName: true,
          completedBy: { select: { name: true, email: true } },
          roomSchedule: {
            select: {
              frequency: true,
              room: { select: { name: true, floor: true, type: true } },
              schedule: { select: { title: true, _count: { select: { tasks: true } } } },
            },
          },
        },
      }),
      equipmentApplies ? prisma.equipmentScheduleCompletionLog.count({ where: equipWhere }) : Promise.resolve(0),
      equipmentApplies
        ? prisma.equipmentScheduleCompletionLog.findMany({
            where: equipWhere,
            orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
            take: cap,
            select: {
              completedAt: true,
              completedTasks: true,
              notes: true,
              equipmentName: true,
              scheduleTitle: true,
              signedName: true,
              // The list API hardcodes this to null; the column exists and the
              // export reads it, so an equipment clean is attributable too.
              completedBy: { select: { name: true, email: true } },
              equipmentSchedule: {
                select: {
                  frequency: true,
                  equipment: { select: { name: true, type: true } },
                  schedule: { select: { title: true, _count: { select: { tasks: true } } } },
                },
              },
            },
          })
        : Promise.resolve([]),
    ])

    const describePerson = (person: { name: string | null; email: string } | null) =>
      person ? (person.name ? `${person.name} (${person.email})` : person.email) : ''

    const countTasks = (value: unknown) => (Array.isArray(value) ? value.length : 0)

    const rows: CompletionRow[] = [
      ...roomLogs.map((log) => ({
        completedAt: log.completedAt,
        kind: 'Room' as const,
        // The schedule relation is SetNull on delete; the snapshot columns keep
        // the compliance record readable after a room is removed.
        itemName: log.roomSchedule?.room?.name ?? log.roomName ?? 'Deleted room',
        floor: log.roomSchedule?.room?.floor ?? null,
        itemType: log.roomSchedule?.room?.type ?? null,
        scheduleTitle: log.roomSchedule?.schedule?.title ?? log.scheduleTitle ?? 'Deleted schedule',
        frequency: log.roomSchedule?.frequency ?? null,
        completedBy: describePerson(log.completedBy),
        tasksDone: countTasks(log.completedTasks),
        totalTasks: log.roomSchedule?.schedule?._count.tasks ?? 0,
        verification: log.verificationMethod,
        signedName: log.signedName,
        notes: log.notes,
      })),
      ...equipLogs.map((log) => ({
        completedAt: log.completedAt,
        kind: 'Equipment' as const,
        itemName: log.equipmentSchedule?.equipment?.name ?? log.equipmentName ?? 'Deleted equipment',
        floor: null,
        itemType: log.equipmentSchedule?.equipment?.type ?? null,
        scheduleTitle: log.equipmentSchedule?.schedule?.title ?? log.scheduleTitle ?? 'Deleted schedule',
        frequency: log.equipmentSchedule?.frequency ?? null,
        completedBy: describePerson(log.completedBy),
        tasksDone: countTasks(log.completedTasks),
        totalTasks: log.equipmentSchedule?.schedule?._count.tasks ?? 0,
        // Equipment cleans have no check-in flow, so they are always manual.
        verification: 'MANUAL',
        signedName: log.signedName,
        notes: log.notes,
      })),
    ]
      .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime())
      .slice(0, cap)

    const total = roomTotal + equipTotal
    const totalTasksDone = rows.reduce((sum, row) => sum + row.tasksDone, 0)

    return {
      rows,
      total,
      subtitle: site.label,
      filters: buildFilterChips([
        ['Site', site.label],
        ['Dates', describeDateWindow(window)],
        ['Room', roomId ? await roomLabel(roomId) : undefined],
        ['Person', userId ? await personLabel(userId) : undefined],
        ['Search', q],
      ]),
      summary: [
        { label: 'Completions', value: String(total) },
        { label: 'Tasks signed off', value: String(totalTasksDone) },
      ],
    }
  },
}

async function roomLabel(roomId: string): Promise<string> {
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { name: true } })
  return room?.name ?? 'Unknown room'
}

async function personLabel(userId: string): Promise<string> {
  const person = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  })
  if (!person) return 'Unknown person'
  return person.name ?? person.email
}

type DiaryRow = {
  nextDue: Date
  kind: 'Room' | 'Equipment'
  itemName: string
  floor: string | null
  siteName: string
  scheduleTitle: string
  frequency: string
  status: string
}

/**
 * Shared loader for the diary and the worklist: both ask "what is due in this
 * window, plus everything already overdue". Keeping one query means a printed
 * worklist and the on-screen diary can never disagree.
 */
async function loadDueWork(
  user: SessionUser,
  siteId: string | null,
  start: Date,
  end: Date,
  cap: number
): Promise<{ rows: DiaryRow[]; total: number }> {
  const dueWindow = {
    OR: [
      {
        AND: [
          { nextDue: { gte: start } },
          { nextDue: { lt: end } },
          { status: { in: [ScheduleStatus.PENDING, ScheduleStatus.IN_PROGRESS] } },
        ],
      },
      { status: ScheduleStatus.OVERDUE },
    ],
  }

  const roomWhere = {
    AND: [nestedSiteScopeWhere(user, 'room'), nestedReadSiteWhere(siteId, 'room'), dueWindow],
  }
  const equipWhere = {
    AND: [nestedSiteScopeWhere(user, 'equipment'), nestedReadSiteWhere(siteId, 'equipment'), dueWindow],
  }

  const [roomTotal, roomSchedules, equipTotal, equipSchedules] = await Promise.all([
    prisma.roomSchedule.count({ where: roomWhere }),
    prisma.roomSchedule.findMany({
      where: roomWhere,
      orderBy: [{ nextDue: 'asc' }, { id: 'asc' }],
      take: cap,
      select: {
        nextDue: true,
        frequency: true,
        status: true,
        room: { select: { name: true, floor: true, site: { select: { name: true } } } },
        schedule: { select: { title: true } },
      },
    }),
    prisma.equipmentSchedule.count({ where: equipWhere }),
    prisma.equipmentSchedule.findMany({
      where: equipWhere,
      orderBy: [{ nextDue: 'asc' }, { id: 'asc' }],
      take: cap,
      select: {
        nextDue: true,
        frequency: true,
        status: true,
        equipment: {
          select: { name: true, site: { select: { name: true } }, serviceArea: { select: { floor: true } } },
        },
        schedule: { select: { title: true } },
      },
    }),
  ])

  const rows: DiaryRow[] = [
    ...roomSchedules.map((rs) => ({
      nextDue: rs.nextDue,
      kind: 'Room' as const,
      itemName: rs.room.name,
      floor: rs.room.floor,
      siteName: rs.room.site?.name ?? '',
      scheduleTitle: rs.schedule.title,
      frequency: rs.frequency,
      status: rs.status,
    })),
    ...equipSchedules.map((es) => ({
      nextDue: es.nextDue,
      kind: 'Equipment' as const,
      itemName: es.equipment.name,
      floor: es.equipment.serviceArea?.floor ?? null,
      siteName: es.equipment.site?.name ?? '',
      scheduleTitle: es.schedule.title,
      frequency: es.frequency,
      status: es.status,
    })),
  ]
    // Overdue first, then by due date. Matches the diary route's ordering so the
    // printed sheet reads in the same order as the screen.
    .sort((a, b) => {
      const aOverdue = a.status === ScheduleStatus.OVERDUE ? 0 : 1
      const bOverdue = b.status === ScheduleStatus.OVERDUE ? 0 : 1
      if (aOverdue !== bOverdue) return aOverdue - bOverdue
      return a.nextDue.getTime() - b.nextDue.getTime()
    })
    .slice(0, cap)

  return { rows, total: roomTotal + equipTotal }
}

const diaryColumns: DatasetDefinition<DiaryRow>['columns'] = [
  { key: 'due', header: 'Due', value: (r) => formatDate(r.nextDue), width: 2 },
  { key: 'dueIn', header: 'When', value: (r) => formatDueLabel(r.nextDue), width: 2 },
  { key: 'status', header: 'Status', value: (r) => humanizeEnum(r.status), width: 2 },
  { key: 'kind', header: 'Kind', value: (r) => r.kind, width: 1 },
  { key: 'item', header: 'Room / equipment', value: (r) => r.itemName, width: 3 },
  { key: 'floor', header: 'Floor', value: (r) => r.floor, width: 2 },
  { key: 'site', header: 'Site', value: (r) => r.siteName, width: 2 },
  { key: 'schedule', header: 'Schedule', value: (r) => r.scheduleTitle, width: 3 },
  { key: 'frequency', header: 'Frequency', value: (r) => humanizeEnum(r.frequency), width: 2 },
]

/** Monday-start week containing `date`, in server local time. */
export function weekBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  // getDay() is 0 for Sunday; shift so Monday is the first day.
  const offset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - offset)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { start, end }
}

export function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

function parseAnchorDate(params: URLSearchParams): Date {
  const raw = params.get('date')
  if (!raw) return new Date()
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

export const diaryDataset: DatasetDefinition<DiaryRow> = {
  title: 'Cleaning diary',
  slug: 'diary',
  cap: 5_000,
  columns: diaryColumns,
  async load({ user, params }, cap) {
    const site = await resolveSiteContext(user, params)
    const anchor = parseAnchorDate(params)
    const { start, end } = weekBounds(anchor)

    const { rows, total } = await loadDueWork(user, site.siteId, start, end, cap)

    return {
      rows,
      total,
      subtitle: site.label,
      filters: buildFilterChips([
        ['Site', site.label],
        ['Week', `${start.toISOString().slice(0, 10)} to ${new Date(end.getTime() - 1).toISOString().slice(0, 10)}`],
      ]),
      summary: [
        { label: 'Due this week', value: String(rows.filter((r) => r.status !== ScheduleStatus.OVERDUE).length) },
        { label: 'Overdue', value: String(rows.filter((r) => r.status === ScheduleStatus.OVERDUE).length) },
      ],
      note: 'Overdue work carries across from earlier weeks and is listed first.',
    }
  },
}

export const worklistDataset: DatasetDefinition<DiaryRow> = {
  title: 'Cleaning worklist',
  slug: 'worklist',
  cap: 2_000,
  columns: diaryColumns,
  async load({ user, params }, cap) {
    const site = await resolveSiteContext(user, params)
    const anchor = parseAnchorDate(params)
    const scope = params.get('scope') === 'week' ? 'week' : 'day'
    const { start, end } = scope === 'week' ? weekBounds(anchor) : dayBounds(anchor)

    const { rows, total } = await loadDueWork(user, site.siteId, start, end, cap)

    const requestedUserId = params.get('userId')?.trim()
    // A cleaner may only ever name themselves; anyone above the line may name a
    // member of a site they can already see.
    const personId = requestedUserId && user.role !== 'CLEANER' ? requestedUserId : user.id
    const person = await prisma.user.findUnique({
      where: { id: personId },
      select: { name: true, email: true, siteId: true },
    })

    const personName = person?.name ?? person?.email ?? null

    return {
      rows,
      total,
      subtitle: personName ? `${personName} - ${site.label}` : site.label,
      filters: buildFilterChips([
        ['Site', site.label],
        ['For', personName],
        [scope === 'week' ? 'Week' : 'Day', scope === 'week'
          ? `${start.toISOString().slice(0, 10)} to ${new Date(end.getTime() - 1).toISOString().slice(0, 10)}`
          : start.toISOString().slice(0, 10)],
      ]),
      summary: [
        { label: scope === 'week' ? 'Due this week' : 'Due today', value: String(rows.filter((r) => r.status !== ScheduleStatus.OVERDUE).length) },
        { label: 'Overdue', value: String(rows.filter((r) => r.status === ScheduleStatus.OVERDUE).length) },
      ],
      // Stated on the document rather than implied, because the allocation model
      // is a real constraint a reader needs to know about: NeatPlan assigns work
      // to a site, not to a named cleaner. Everyone rostered at this site shares
      // this list, and whoever signs a task off is recorded on the completion.
      note: 'Work is allocated per site, not per person. Everyone cleaning at this site works from this list; the completion record names whoever signed each task off.',
    }
  },
}

type ScheduleRow = {
  title: string
  suggestedFrequency: string | null
  detectedFrequency: string | null
  taskCount: number
  siteNames: string
  roomCount: number
  equipmentCount: number
}

export const schedulesDataset: DatasetDefinition<ScheduleRow> = {
  title: 'Cleaning schedules',
  slug: 'schedules',
  cap: 2_000,
  columns: [
    { key: 'title', header: 'Schedule', value: (r) => r.title, width: 4 },
    { key: 'frequency', header: 'Frequency', value: (r) => humanizeEnum(r.suggestedFrequency), width: 2 },
    { key: 'detected', header: 'Detected as', value: (r) => r.detectedFrequency, width: 2, only: 'csv' },
    { key: 'tasks', header: 'Tasks', value: (r) => r.taskCount, align: 'right', width: 1 },
    { key: 'sites', header: 'Sites', value: (r) => r.siteNames, wrap: true, width: 3 },
    { key: 'rooms', header: 'Rooms assigned', value: (r) => r.roomCount, align: 'right', width: 1 },
    { key: 'equipment', header: 'Equipment assigned', value: (r) => r.equipmentCount, align: 'right', width: 1 },
  ],
  async load({ user, params }, cap) {
    const site = await resolveSiteContext(user, params)
    const q = searchTerm(params)

    const { m2mSiteScopeWhere, m2mReadSiteWhere, visibleSiteRelationWhere } = await import('@/lib/authz')

    const where = {
      AND: [
        m2mSiteScopeWhere(user),
        m2mReadSiteWhere(site.siteId),
        ...(q ? [{ title: { contains: q, mode: 'insensitive' as const } }] : []),
      ],
    }

    const [total, schedules] = await Promise.all([
      prisma.schedule.count({ where }),
      prisma.schedule.findMany({
        where,
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
        take: cap,
        select: {
          title: true,
          suggestedFrequency: true,
          detectedFrequency: true,
          _count: { select: { tasks: true, rooms: true, equipment: true } },
          // A site-pinned exporter must not learn the names of other sites this
          // template is shared with.
          sites: { where: visibleSiteRelationWhere(user), select: { name: true }, orderBy: { name: 'asc' } },
        },
      }),
    ])

    return {
      rows: schedules.map((schedule) => ({
        title: schedule.title,
        suggestedFrequency: schedule.suggestedFrequency,
        detectedFrequency: schedule.detectedFrequency,
        taskCount: schedule._count.tasks,
        siteNames: schedule.sites.map((s) => s.name).join(', '),
        roomCount: schedule._count.rooms,
        equipmentCount: schedule._count.equipment,
      })),
      total,
      subtitle: site.label,
      filters: buildFilterChips([
        ['Site', site.label],
        ['Search', q],
      ]),
      summary: [
        { label: 'Schedules', value: String(total) },
        { label: 'Tasks', value: String(schedules.reduce((n, s) => n + s._count.tasks, 0)) },
      ],
    }
  },
}
