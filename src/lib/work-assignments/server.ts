import 'server-only'
import { prisma } from '@/lib/db'
import { Prisma } from '@/generated/prisma/client'
import {
  canAccessSite,
  resolveReadSiteId,
  readSiteWhere,
  siteScopeWhere,
  type SessionUser,
} from '@/lib/authz'
import { isManagementRole } from '@/lib/roles'
import { localDateKey } from '@/lib/digest/week'
import {
  assignmentDates,
  assignmentDayStart,
  calendarDate,
  eligibleAssignee,
  nextDate,
  todayAssignmentDate,
  type AssignmentBoard,
} from './policy'

export class AssignmentError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const assigneeSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  siteId: true,
  isBlocked: true,
  isHidden: true,
} as const

export async function loadAssignmentBoard(
  user: SessionUser,
  params: URLSearchParams,
  now = new Date(),
): Promise<AssignmentBoard> {
  const today = localDateKey(now)
  const dates = assignmentDates(
    params.get('date') || today,
    params.get('scope') === 'week' ? 'week' : 'day',
  )
  const siteId = resolveReadSiteId(user, params.get('site'))
  const siteWhere = { AND: [siteScopeWhere(user), readSiteWhere(siteId)] }
  const targetId = params.get('targetId')
  const targetKind = params.get('kind')
  const roomWhere = {
    ...siteWhere,
    ...(targetId ? { id: targetKind === 'room' ? targetId : '__none__' } : {}),
  }
  const equipmentWhere = {
    ...siteWhere,
    ...(targetId ? { id: targetKind === 'equipment' ? targetId : '__none__' } : {}),
  }
  const start = assignmentDayStart(dates[0])
  const end = assignmentDayStart(nextDate(dates[dates.length - 1]))
  const scheduleInclude = {
    include: {
      schedule: { select: { title: true } },
      completionLogs: {
        where: { completedAt: { gte: start, lt: end } },
        select: { completedAt: true, signedName: true },
      },
    },
  } as const
  const assignmentInclude = {
    where: {
      workDate: { gte: calendarDate(dates[0]), lte: calendarDate(dates[dates.length - 1]) },
    },
    include: { assignee: { select: assigneeSelect } },
  }
  const [rooms, equipment, roomCount, equipmentCount, people] = await Promise.all([
    prisma.room.findMany({
      where: roomWhere,
      take: 500,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: {
        site: { select: { name: true } },
        schedules: scheduleInclude,
        workAssignments: assignmentInclude,
      },
    }),
    prisma.equipment.findMany({
      where: equipmentWhere,
      take: 500,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: {
        site: { select: { name: true } },
        serviceArea: { select: { floor: true } },
        schedules: scheduleInclude,
        workAssignments: assignmentInclude,
      },
    }),
    prisma.room.count({ where: roomWhere }),
    prisma.equipment.count({ where: equipmentWhere }),
    isManagementRole(user.role)
      ? prisma.user.findMany({
          where: {
            ...siteWhere,
            role: { in: ['CLEANER', 'HEAD_OF_HOUSEKEEPING'] },
            isBlocked: false,
            isHidden: false,
            siteId: { not: null },
          },
          select: { id: true, name: true, email: true, siteId: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          take: 500,
        })
      : Promise.resolve([]),
  ])
  const assets = [
    ...rooms.map((room) => ({ ...room, kind: 'room' as const })),
    ...equipment.map((item) => ({
      ...item,
      kind: 'equipment' as const,
      floor: item.serviceArea?.floor ?? null,
    })),
  ]
  return {
    dates,
    today,
    truncated: roomCount > 500 || equipmentCount > 500,
    people: people.flatMap((person) =>
      person.siteId
        ? [{ id: person.id, name: person.name || person.email, siteId: person.siteId }]
        : [],
    ),
    rows: assets.flatMap((asset) =>
      !asset.siteId
        ? []
        : dates.map((date) => {
            const assignment = asset.workAssignments.find(
              (item) => item.workDate.toISOString().slice(0, 10) === date,
            )
            // Historical allocation names are snapshots. Current/future names must still
            // belong to a usable account at this asset's current site.
            const active =
              assignment?.siteId === asset.siteId &&
              (date < today
                ? !!assignment.assigneeName
                : eligibleAssignee(assignment.assignee, asset.siteId!))
            const dayEnd = assignmentDayStart(nextDate(date))
            const dayStart = assignmentDayStart(date)
            const completed = asset.schedules.flatMap((schedule) =>
              schedule.completionLogs
                .filter((log) => log.completedAt >= dayStart && log.completedAt < dayEnd)
                .map(
                  (log) =>
                    `${schedule.schedule.title}${log.signedName ? ` (${log.signedName})` : ''}`,
                ),
            )
            const due = asset.schedules
              .filter(
                (schedule) =>
                  ['PENDING', 'OVERDUE', 'IN_PROGRESS'].includes(schedule.status) &&
                  schedule.nextDue < dayEnd &&
                  !schedule.completionLogs.some(
                    (log) => log.completedAt >= dayStart && log.completedAt < dayEnd,
                  ),
              )
              .map((schedule) => schedule.schedule.title)
            return {
              kind: asset.kind,
              targetId: asset.id,
              targetName: asset.name,
              siteId: asset.siteId!,
              siteName: asset.site?.name ?? '',
              floor: asset.floor,
              date,
              assignment: {
                assigneeId: active ? (assignment?.assigneeId ?? null) : null,
                assigneeName: active ? (assignment?.assigneeName ?? null) : null,
                revision: assignment?.revision ?? 0,
              },
              due,
              completed,
            }
          }),
    ),
  }
}

export async function saveAssignment(
  user: SessionUser,
  input: {
    kind: 'room' | 'equipment'
    targetId: string
    date: string
    assigneeId: string | null
    revision: number
  },
  now = new Date(),
) {
  const today = localDateKey(now)
  if (input.date < today) throw new AssignmentError('Past allocations cannot be changed', 400)
  const date = calendarDate(input.date)
  const horizon = calendarDate(today)
  horizon.setUTCDate(horizon.getUTCDate() + 366)
  if (date > horizon) throw new AssignmentError('Choose a date within the next year', 400)
  return prisma.$transaction(async (tx) => {
    // Person and asset row locks serialize membership changes with allocation.
    // FOR SHARE also blocks non-key site/role updates; KEY SHARE would not.
    if (input.assigneeId)
      await tx.$queryRaw(Prisma.sql`SELECT id FROM users WHERE id = ${input.assigneeId} FOR SHARE`)
    const assets =
      input.kind === 'room'
        ? await tx.$queryRaw<{ id: string; siteId: string | null }[]>(
            Prisma.sql`SELECT id, "siteId" FROM rooms WHERE id = ${input.targetId} FOR SHARE`,
          )
        : await tx.$queryRaw<{ id: string; siteId: string | null }[]>(
            Prisma.sql`SELECT id, "siteId" FROM equipment WHERE id = ${input.targetId} FOR SHARE`,
          )
    const asset = assets[0]
    if (!asset?.siteId || !canAccessSite(user, asset.siteId))
      throw new AssignmentError('Room or equipment not found', 404)
    const person = input.assigneeId
      ? await tx.user.findUnique({ where: { id: input.assigneeId }, select: assigneeSelect })
      : null
    if (input.assigneeId && !eligibleAssignee(person, asset.siteId))
      throw new AssignmentError('Choose an available cleaner at this site', 400)
    const target =
      input.kind === 'room' ? { roomId: input.targetId } : { equipmentId: input.targetId }
    const data = {
      assigneeId: input.assigneeId,
      assigneeName: person?.name || person?.email || null,
      assignedById: user.id,
      assignedByName: user.name || user.email || null,
      siteId: asset.siteId,
    }
    if (input.revision === 0)
      return tx.workAssignment.create({ data: { ...target, ...data, workDate: date } })
    const result = await tx.workAssignment.updateMany({
      where: { ...target, workDate: date, revision: input.revision },
      data: { ...data, revision: { increment: 1 } },
    })
    if (result.count !== 1)
      throw new AssignmentError('This allocation changed. Reload before saving again.', 409)
    return tx.workAssignment.findFirstOrThrow({ where: { ...target, workDate: date } })
  })
}

export async function plannedAssigneeSnapshot(
  tx: Prisma.TransactionClient,
  kind: 'room' | 'equipment',
  targetId: string,
  siteId: string | null,
  now: Date,
) {
  if (!siteId) return {}
  const assignment = await tx.workAssignment.findFirst({
    where: {
      ...(kind === 'room' ? { roomId: targetId } : { equipmentId: targetId }),
      siteId,
      workDate: todayAssignmentDate(now),
    },
    include: { assignee: { select: assigneeSelect } },
  })
  if (!assignment || !eligibleAssignee(assignment.assignee, siteId)) return {}
  return {
    plannedAssigneeId: assignment.assigneeId,
    plannedAssigneeName: assignment.assigneeName,
    assignmentDate: assignment.workDate,
  }
}
