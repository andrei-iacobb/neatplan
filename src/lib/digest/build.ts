import 'server-only'

import { prisma } from '@/lib/db'
import { ScheduleStatus } from '@/generated/prisma/enums'
import { digestWeek, DIGEST_TIMEZONE, type DigestWeek } from './week'

/**
 * Gathering what goes into one person's weekly digest.
 *
 * Everything is scoped to the recipient's own site. There is no "digest for all
 * sites" - a Director with no site would otherwise receive a wall of every room
 * in the company, which is not a digest, and the recipient rule below reflects
 * that.
 */

/** A cap so one bad week cannot produce a ten-thousand-row email. */
const MAX_ROWS_PER_SECTION = 60

export interface DigestRow {
  kind: 'Room' | 'Equipment'
  name: string
  place: string | null
  schedule: string
  due: Date
  /** Whole days late. Zero or negative for work that is not yet overdue. */
  daysLate: number
}

export interface DigestContent {
  siteName: string
  week: DigestWeek
  timeZone: string
  /** Already overdue when the digest was built. Listed first, worst first. */
  overdue: DigestRow[]
  /** Falls due inside the covered week. */
  due: DigestRow[]
  /** Completed in the week just gone, as a counterweight to the bad news. */
  completedLastWeek: number
  /** True when a section was cut by the row cap. */
  truncated: boolean
}

function startOfDay(date: Date): number {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy.getTime()
}

function daysLate(due: Date, now: Date): number {
  return Math.round((startOfDay(now) - startOfDay(due)) / 86_400_000)
}

export interface BuildDigestOptions {
  siteId: string
  now?: Date
  timeZone?: string
}

/**
 * Build the digest for one site.
 *
 * Deliberately reads the same schedule state the diary and the exports read, so
 * a manager who opens the app after reading the email sees the same picture
 * rather than a second opinion.
 */
export async function buildDigest({
  siteId,
  now = new Date(),
  timeZone = DIGEST_TIMEZONE,
}: BuildDigestOptions): Promise<DigestContent> {
  const week = digestWeek(now, timeZone)

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { name: true },
  })

  const dueWindow = {
    OR: [
      {
        AND: [
          { nextDue: { gte: week.start } },
          { nextDue: { lt: week.end } },
          { status: { in: [ScheduleStatus.PENDING, ScheduleStatus.IN_PROGRESS] } },
        ],
      },
      { status: ScheduleStatus.OVERDUE },
    ],
  }

  const previousWeekStart = new Date(week.start.getTime() - 7 * 86_400_000)

  const [roomSchedules, equipmentSchedules, roomCompletions, equipmentCompletions] =
    await Promise.all([
      prisma.roomSchedule.findMany({
        where: { AND: [{ room: { siteId } }, dueWindow] },
        orderBy: [{ nextDue: 'asc' }, { id: 'asc' }],
        take: MAX_ROWS_PER_SECTION * 2,
        select: {
          nextDue: true,
          status: true,
          room: { select: { name: true, floor: true } },
          schedule: { select: { title: true } },
        },
      }),
      prisma.equipmentSchedule.findMany({
        where: { AND: [{ equipment: { siteId } }, dueWindow] },
        orderBy: [{ nextDue: 'asc' }, { id: 'asc' }],
        take: MAX_ROWS_PER_SECTION * 2,
        select: {
          nextDue: true,
          status: true,
          equipment: { select: { name: true, serviceArea: { select: { name: true } } } },
          schedule: { select: { title: true } },
        },
      }),
      prisma.roomScheduleCompletionLog.count({
        where: {
          roomSchedule: { room: { siteId } },
          completedAt: { gte: previousWeekStart, lt: week.start },
        },
      }),
      prisma.equipmentScheduleCompletionLog.count({
        where: {
          equipmentSchedule: { equipment: { siteId } },
          completedAt: { gte: previousWeekStart, lt: week.start },
        },
      }),
    ])

  const rows: DigestRow[] = [
    ...roomSchedules.map((entry) => ({
      kind: 'Room' as const,
      name: entry.room.name,
      place: entry.room.floor,
      schedule: entry.schedule.title,
      due: entry.nextDue,
      daysLate: daysLate(entry.nextDue, now),
    })),
    ...equipmentSchedules.map((entry) => ({
      kind: 'Equipment' as const,
      name: entry.equipment.name,
      place: entry.equipment.serviceArea?.name ?? null,
      schedule: entry.schedule.title,
      due: entry.nextDue,
      daysLate: daysLate(entry.nextDue, now),
    })),
  ]

  const isOverdue = (entry: { status: string }) => entry.status === ScheduleStatus.OVERDUE
  const overdueSource = [...roomSchedules, ...equipmentSchedules].filter(isOverdue).length

  // Split by status rather than by date: a schedule can be OVERDUE with a
  // nextDue inside this week, and it belongs in the section that says so.
  const overdueRows = rows
    .filter((row) => row.daysLate > 0)
    .sort((a, b) => b.daysLate - a.daysLate)
  const dueRows = rows
    .filter((row) => row.daysLate <= 0)
    .sort((a, b) => a.due.getTime() - b.due.getTime())

  return {
    siteName: site?.name ?? 'Your site',
    week,
    timeZone,
    overdue: overdueRows.slice(0, MAX_ROWS_PER_SECTION),
    due: dueRows.slice(0, MAX_ROWS_PER_SECTION),
    completedLastWeek: roomCompletions + equipmentCompletions,
    truncated:
      overdueRows.length > MAX_ROWS_PER_SECTION ||
      dueRows.length > MAX_ROWS_PER_SECTION ||
      overdueSource > MAX_ROWS_PER_SECTION * 2,
  }
}

export interface DigestRecipient {
  id: string
  email: string
  name: string | null
  siteId: string
}

/**
 * Who receives a digest.
 *
 * Two conditions, both required. The role has to be one that acts on a site's
 * cleaning - Manager or Head of Housekeeping - and the person has to have turned
 * the digest ON. It is off by default and always has been: nobody should start
 * receiving a weekly email because a version shipped.
 *
 * A site-spanning role (OP, Director) is deliberately excluded. A digest for
 * every site at once is not a digest, and neither role is who chases a room.
 *
 * `notificationEmail` wins over the login address when it is set, because that
 * is what the column is for.
 */
export async function digestRecipients(): Promise<DigestRecipient[]> {
  const candidates = await prisma.user.findMany({
    where: {
      role: { in: ['MANAGER', 'HEAD_OF_HOUSEKEEPING'] },
      siteId: { not: null },
      isBlocked: false,
      isHidden: false,
    },
    select: { id: true, email: true, notificationEmail: true, name: true, siteId: true, settings: true },
  })

  return candidates
    .filter((candidate) => digestEnabled(candidate.settings))
    .map((candidate) => ({
      id: candidate.id,
      email: candidate.notificationEmail?.trim() || candidate.email,
      name: candidate.name,
      siteId: candidate.siteId as string,
    }))
}

/**
 * Has this person opted in?
 *
 * Absent means no. The settings blob predates this feature, so every existing
 * user has no value here - and reading that as consent is exactly how a release
 * turns into a surprise inbox.
 */
export function digestEnabled(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') return false
  const notifications = (settings as { notifications?: unknown }).notifications
  if (!notifications || typeof notifications !== 'object') return false
  return (notifications as { weeklyDigest?: unknown }).weeklyDigest === true
}
