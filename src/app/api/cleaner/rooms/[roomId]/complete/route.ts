import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@/generated/prisma/client'
import { ScheduleStatus } from '@/generated/prisma/enums'
import { calculateNextDueDate } from '@/lib/schedule-utils'
import { canAccessSite } from '@/lib/authz'
import { canUseCleaningPortal } from '@/lib/roles'

const SIGNATURE_PREFIX = 'data:image/png;base64,'
const MAX_SIGNATURE_BYTES = 100 * 1024
const MAX_SCHEDULES_PER_COMPLETION = 20
const MAX_TASK_ROWS_PER_COMPLETION = 500

type SignOff = { signatureDataUrl: string; signedName: string }
type TaskRef = { scheduleId: string; taskId: string }

class ConcurrentCompletionError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseScheduleIds(scheduleId: unknown, scheduleIds: unknown): string[] | { error: string } {
  const rawIds = Array.isArray(scheduleIds) ? scheduleIds : [scheduleId]
  if (rawIds.length === 0 || rawIds.length > MAX_SCHEDULES_PER_COMPLETION) {
    return { error: `Choose between 1 and ${MAX_SCHEDULES_PER_COMPLETION} schedules` }
  }

  const ids = rawIds.map((id) => typeof id === 'string' ? id.trim() : '')
  if (ids.some((id) => id.length === 0)) {
    return { error: 'Missing required fields: scheduleId, completedTasks' }
  }
  if (new Set(ids).size !== ids.length) {
    return { error: 'The same schedule was submitted more than once' }
  }

  return ids
}

/**
 * A completion log is a compliance record, so every new one has to carry the sign-off
 * the cleaner gave on their device: the signature they drew and the name they printed.
 */
function parseSignOff(signature: unknown, signedName: unknown): SignOff | { error: string } {
  if (typeof signature !== 'string' || !signature.startsWith(SIGNATURE_PREFIX)) {
    return { error: 'A signature is required to sign off this room' }
  }

  const base64 = signature.slice(SIGNATURE_PREFIX.length)
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return { error: 'Signature image is malformed' }
  }

  // 4 base64 chars encode 3 bytes - measure without allocating a Buffer for the image.
  if (Math.floor((base64.length * 3) / 4) > MAX_SIGNATURE_BYTES) {
    return { error: 'Signature image is too large' }
  }

  const name = typeof signedName === 'string' ? signedName.trim() : ''
  if (name.length < 2 || name.length > 80) {
    return { error: 'A printed name of 2 to 80 characters is required' }
  }

  return { signatureDataUrl: signature, signedName: name }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  const params = await context.params
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!canUseCleaningPortal(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { roomId } = params
    const body = await request.json()
    const { scheduleId, scheduleIds: submittedScheduleIds, completedTasks, notes, duration, signature, signedName } = body
    const parsedScheduleIds = parseScheduleIds(scheduleId, submittedScheduleIds)

    // Validate required fields
    if ('error' in parsedScheduleIds || !Array.isArray(completedTasks)) {
      return NextResponse.json(
        { error: 'error' in parsedScheduleIds ? parsedScheduleIds.error : 'Missing required fields: scheduleId, completedTasks' },
        { status: 400 }
      )
    }

    if (completedTasks.length === 0 || completedTasks.length > MAX_TASK_ROWS_PER_COMPLETION) {
      return NextResponse.json(
        { error: completedTasks.length === 0 ? 'At least one task must be completed' : 'Too many completed tasks were submitted' },
        { status: 400 }
      )
    }

    const signOff = parseSignOff(signature, signedName)
    if ('error' in signOff) {
      return NextResponse.json({ error: signOff.error }, { status: 400 })
    }

    const [primaryScheduleId, ...additionalScheduleIds] = parsedScheduleIds
    const primarySchedule = await prisma.roomSchedule.findUnique({
      where: {
        id: primaryScheduleId
      },
      include: {
        room: { select: { name: true, siteId: true } },
        schedule: {
          include: {
            tasks: true
          }
        }
      }
    })

    if (!primarySchedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    const additionalSchedules = additionalScheduleIds.length > 0
      ? await prisma.roomSchedule.findMany({
          where: { id: { in: additionalScheduleIds } },
          include: {
            room: { select: { name: true, siteId: true } },
            schedule: { include: { tasks: true } },
          },
        })
      : []
    const roomSchedules = [primarySchedule, ...additionalSchedules]

    if (roomSchedules.length !== parsedScheduleIds.length) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // A cleaning user may only complete schedules for rooms in their own site. Return 404
    // (not 403) so we don't leak the existence of rooms belonging to other sites.
    if (roomSchedules.some((roomSchedule) => !canAccessSite(session.user, roomSchedule.room?.siteId))) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    if (roomSchedules.some((roomSchedule) => roomSchedule.roomId !== roomId)) {
      return NextResponse.json(
        { error: 'One or more schedules do not belong to this room' },
        { status: 400 }
      )
    }

    // A merged row can represent one task from several source schedules. Keep that
    // provenance all the way to the audit log, and validate every reference against
    // the server-loaded schedule rather than trusting the client package.
    const schedulesById = new Map<string, typeof primarySchedule>([[primaryScheduleId, primarySchedule]])
    for (const roomSchedule of additionalSchedules) schedulesById.set(roomSchedule.id, roomSchedule)

    const validTaskIds = new Map(
      [...schedulesById].map(([id, roomSchedule]) => [
        id,
        new Set((roomSchedule.schedule?.tasks ?? []).map((task) => task.id)),
      ]),
    )
    const verifiedTasks = new Map(
      parsedScheduleIds.map((id) => [id, [] as { taskId: string; notes: string | null }[]]),
    )
    const seenTaskRefs = new Set<string>()

    const taskEntries: unknown[] = completedTasks
    for (const entry of taskEntries) {
      const entryRecord = isRecord(entry) ? entry : null
      const rawRefs: unknown[] = Array.isArray(entryRecord?.taskRefs)
        ? entryRecord.taskRefs
        : [typeof entry === 'string' ? { scheduleId: primaryScheduleId, taskId: entry } : {
            scheduleId: primaryScheduleId,
            taskId: entryRecord?.taskId,
          }]
      const entryNotes = entryRecord?.notes
      const normalizedNotes = typeof entryNotes === 'string' && entryNotes.trim()
        ? entryNotes.trim().slice(0, 1000)
        : null

      if (rawRefs.length === 0 || rawRefs.length > parsedScheduleIds.length) {
        return NextResponse.json(
          { error: 'One or more completed tasks do not belong to this schedule' },
          { status: 400 }
        )
      }

      for (const rawRef of rawRefs) {
        if (!isRecord(rawRef)) {
          return NextResponse.json(
            { error: 'One or more completed tasks do not belong to this schedule' },
            { status: 400 }
          )
        }

        const ref: TaskRef = {
          scheduleId: typeof rawRef.scheduleId === 'string' ? rawRef.scheduleId : '',
          taskId: typeof rawRef.taskId === 'string' ? rawRef.taskId : '',
        }
        if (!validTaskIds.get(ref.scheduleId)?.has(ref.taskId)) {
          return NextResponse.json(
            { error: 'One or more completed tasks do not belong to this schedule' },
            { status: 400 }
          )
        }

        const refKey = `${ref.scheduleId}:${ref.taskId}`
        if (seenTaskRefs.has(refKey)) {
          return NextResponse.json(
            { error: 'The same task was submitted more than once' },
            { status: 400 }
          )
        }
        seenTaskRefs.add(refKey)
        verifiedTasks.get(ref.scheduleId)?.push({ taskId: ref.taskId, notes: normalizedNotes })
      }
    }

    if (parsedScheduleIds.some((id) => verifiedTasks.get(id)?.length === 0)) {
      return NextResponse.json(
        { error: 'Complete at least one task from each included schedule' },
        { status: 400 }
      )
    }

    if (parsedScheduleIds.some((id) => verifiedTasks.get(id)?.length !== validTaskIds.get(id)?.size)) {
      return NextResponse.json(
        { error: 'Complete every task in each included schedule before signing off' },
        { status: 400 },
      )
    }

    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    // A schedule can be signed off once per day. Without this, the same completion could
    // be replayed back to back - each pass writing another compliance log and pushing
    // nextDue further out. Mirrors the `completedToday` flag the cleaner UI already shows.
    if (roomSchedules.some((roomSchedule) => roomSchedule.lastCompleted && roomSchedule.lastCompleted >= startOfToday)) {
      return NextResponse.json(
        { error: 'One or more schedules have already been completed today', duplicate: true },
        { status: 409 }
      )
    }

    const cleanSessionNotes = typeof notes === 'string' && notes.trim()
      ? notes.trim().slice(0, 2000)
      : null

    // Complete inside a transaction, guarding against double submits (double-tap on a
    // tablet, network retry): only one concurrent completion advances the cycle. The
    // optimistic match on lastCompleted means the loser writes nothing and is reported
    // as an idempotent duplicate instead of creating a second log / skipping a cycle.
    let result: { completionIds: string[]; nextDueDates: Date[] }
    try {
      result = await prisma.$transaction(async (tx) => {
        const completionIds: string[] = []
        const nextDueDates: Date[] = []
        const dueDatesBySchedule = new Map<string, Date>()

        // Overlapping submissions must acquire row locks in the same order.
        for (const requestedId of [...parsedScheduleIds].sort()) {
          const roomSchedule = schedulesById.get(requestedId)
          if (!roomSchedule) throw new ConcurrentCompletionError()

          const nextDue = calculateNextDueDate(roomSchedule.frequency, now)
          const advanced = await tx.roomSchedule.updateMany({
            where: { id: requestedId, lastCompleted: roomSchedule.lastCompleted },
            data: {
              status: ScheduleStatus.PENDING,
              lastCompleted: now,
              nextDue,
            },
          })

          // Throwing rolls back earlier advances in this package. Returning a flag
          // here would commit a half-completed room under a concurrent double-submit.
          if (advanced.count === 0) throw new ConcurrentCompletionError()
          dueDatesBySchedule.set(requestedId, nextDue)
        }

        for (const requestedId of parsedScheduleIds) {
          const roomSchedule = schedulesById.get(requestedId)
          const nextDue = dueDatesBySchedule.get(requestedId)
          if (!roomSchedule || !nextDue) throw new ConcurrentCompletionError()

          const completionLog = await tx.roomScheduleCompletionLog.create({
            data: {
              roomScheduleId: requestedId,
              completedTasks: verifiedTasks.get(requestedId) ?? [],
              notes: cleanSessionNotes,
              completedAt: now,
              completedByUserId: session.user.id,
              signatureDataUrl: signOff.signatureDataUrl,
              signedName: signOff.signedName,
              signedAt: now,
              roomName: roomSchedule.room?.name ?? null,
              scheduleTitle: roomSchedule.schedule?.title ?? null,
            },
          })
          completionIds.push(completionLog.id)
          nextDueDates.push(nextDue)
        }

        return { completionIds, nextDueDates }
      })
    } catch (error) {
      if (error instanceof ConcurrentCompletionError) {
        return NextResponse.json(
          { error: 'This room was just completed', duplicate: true },
          { status: 409 }
        )
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return NextResponse.json(
          { error: 'This room changed during completion. Reload it before trying again.' },
          { status: 409 },
        )
      }
      throw error
    }

    if (result.completionIds.length === 0) {
      return NextResponse.json(
        { error: 'Failed to complete schedule' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Room cleaning completed successfully',
      completionId: result.completionIds[0],
      completionIds: result.completionIds,
      nextDue: result.nextDueDates[0].toISOString(),
      data: {
        completedTasks: [...verifiedTasks.values()].reduce((total, tasks) => total + tasks.length, 0),
        duration: duration || null,
        scheduleIds: parsedScheduleIds,
        signedName: signOff.signedName
      }
    })

  } catch (error) {
    console.error('Error completing schedule:', error)
    return NextResponse.json(
      { error: 'Failed to complete schedule' },
      { status: 500 }
    )
  }
}

// unified calculateNextDueDate is used from lib
