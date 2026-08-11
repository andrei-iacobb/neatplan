import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ScheduleStatus } from '@/generated/prisma/enums'
import { calculateNextDueDate } from '@/lib/schedule-utils'
import { canAccessSite } from '@/lib/authz'

const SIGNATURE_PREFIX = 'data:image/png;base64,'
const MAX_SIGNATURE_BYTES = 100 * 1024

type SignOff = { signatureDataUrl: string; signedName: string }

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

    // Only cleaners should access this endpoint
    if (session.user.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin users should use the admin interface' },
        { status: 403 }
      )
    }

    const { roomId } = params
    const body = await request.json()
    const { scheduleId, completedTasks, notes, duration, signature, signedName } = body

    // Validate required fields
    if (!scheduleId || !completedTasks || !Array.isArray(completedTasks)) {
      return NextResponse.json(
        { error: 'Missing required fields: scheduleId, completedTasks' },
        { status: 400 }
      )
    }

    if (completedTasks.length === 0) {
      return NextResponse.json(
        { error: 'At least one task must be completed' },
        { status: 400 }
      )
    }

    const signOff = parseSignOff(signature, signedName)
    if ('error' in signOff) {
      return NextResponse.json({ error: signOff.error }, { status: 400 })
    }

    // Get the room schedule
    const roomSchedule = await prisma.roomSchedule.findUnique({
      where: {
        id: scheduleId
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

    if (!roomSchedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // A CLEANER may only complete schedules for rooms in their own site. Return 404
    // (not 403) so we don't leak the existence of rooms belonging to other sites.
    if (!canAccessSite(session.user, roomSchedule.room?.siteId)) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    if (roomSchedule.roomId !== roomId) {
      return NextResponse.json(
        { error: 'Schedule does not belong to this room' },
        { status: 400 }
      )
    }

    // Only accept task IDs that actually belong to this schedule. The submitted array
    // used to be written into the compliance log verbatim, so a cleaner could log tasks
    // that never existed - or omit the ID entirely and still have it recorded as work.
    const validTaskIds = new Set((roomSchedule.schedule?.tasks ?? []).map((task) => task.id))
    const seenTaskIds = new Set<string>()
    const verifiedTasks: { taskId: string; notes: string | null }[] = []

    for (const entry of completedTasks) {
      const taskId = typeof entry === 'string' ? entry : entry?.taskId

      if (typeof taskId !== 'string' || !validTaskIds.has(taskId)) {
        return NextResponse.json(
          { error: 'One or more completed tasks do not belong to this schedule' },
          { status: 400 }
        )
      }

      if (seenTaskIds.has(taskId)) {
        return NextResponse.json(
          { error: 'The same task was submitted more than once' },
          { status: 400 }
        )
      }
      seenTaskIds.add(taskId)

      const entryNotes = typeof entry === 'object' && entry !== null ? entry.notes : null
      verifiedTasks.push({
        taskId,
        notes: typeof entryNotes === 'string' && entryNotes.trim() ? entryNotes.trim().slice(0, 1000) : null,
      })
    }

    const now = new Date()
    const startOfToday = new Date(now)
    startOfToday.setHours(0, 0, 0, 0)

    // A schedule can be signed off once per day. Without this, the same completion could
    // be replayed back to back - each pass writing another compliance log and pushing
    // nextDue further out. Mirrors the `completedToday` flag the cleaner UI already shows.
    if (roomSchedule.lastCompleted && roomSchedule.lastCompleted >= startOfToday) {
      return NextResponse.json(
        { error: 'This schedule has already been completed today', duplicate: true },
        { status: 409 }
      )
    }

    // Calculate next due date based on frequency
    const nextDue = calculateNextDueDate(roomSchedule.frequency as any, now)

    // Complete inside a transaction, guarding against double submits (double-tap on a
    // tablet, network retry): only one concurrent completion advances the cycle. The
    // optimistic match on lastCompleted means the loser writes nothing and is reported
    // as an idempotent duplicate instead of creating a second log / skipping a cycle.
    const result = await prisma.$transaction(async (tx) => {
      const advanced = await tx.roomSchedule.updateMany({
        where: { id: scheduleId, lastCompleted: roomSchedule.lastCompleted },
        data: {
          status: ScheduleStatus.PENDING,
          lastCompleted: now,
          nextDue,
        },
      })

      if (advanced.count === 0) {
        return { duplicate: true as const }
      }

      const completionLog = await tx.roomScheduleCompletionLog.create({
        data: {
          roomScheduleId: scheduleId,
          completedTasks: verifiedTasks,
          notes: notes || null,
          completedAt: now,
          completedByUserId: session.user.id,
          signatureDataUrl: signOff.signatureDataUrl,
          signedName: signOff.signedName,
          signedAt: now,
          // Snapshot identifying info so the record survives room/schedule deletion.
          roomName: roomSchedule.room?.name ?? null,
          scheduleTitle: roomSchedule.schedule?.title ?? null,
        },
      })

      return { completionLog }
    })

    if ('duplicate' in result) {
      return NextResponse.json(
        { error: 'This schedule was just completed', duplicate: true },
        { status: 409 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule completed successfully',
      completionId: result.completionLog.id,
      nextDue: nextDue.toISOString(),
      data: {
        completedTasks: verifiedTasks.length,
        duration: duration || null,
        scheduleId,
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
