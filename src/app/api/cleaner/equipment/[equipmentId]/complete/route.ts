import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { ScheduleStatus } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { canAccessSite, siteScopeWhere } from '@/lib/authz'
import { prisma } from '@/lib/db'
import { calculateNextDueDate } from '@/lib/schedule-utils'

const SIGNATURE_PREFIX = 'data:image/png;base64,'
const MAX_SIGNATURE_BYTES = 100 * 1024

type SignOff = { signatureDataUrl: string; signedName: string }

function parseSignOff(signature: unknown, signedName: unknown): SignOff | { error: string } {
  if (typeof signature !== 'string' || !signature.startsWith(SIGNATURE_PREFIX)) {
    return { error: 'A signature is required to sign off this equipment' }
  }
  const base64 = signature.slice(SIGNATURE_PREFIX.length)
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return { error: 'Signature image is malformed' }
  }
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
  context: { params: Promise<{ equipmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin users should use the admin interface' },
        { status: 403 }
      )
    }

    const { equipmentId } = await context.params
    const { scheduleId, completedTasks, notes, duration, signature, signedName } =
      await request.json()

    if (!scheduleId || !completedTasks || !Array.isArray(completedTasks)) {
      return NextResponse.json(
        { error: 'Missing required fields: scheduleId, completedTasks' },
        { status: 400 }
      )
    }
    if (completedTasks.length === 0) {
      return NextResponse.json({ error: 'At least one task must be completed' }, { status: 400 })
    }

    const signOff = parseSignOff(signature, signedName)
    if ('error' in signOff) {
      return NextResponse.json({ error: signOff.error }, { status: 400 })
    }

    const equipmentSchedule = await prisma.equipmentSchedule.findFirst({
      where: {
        id: scheduleId,
        equipment: siteScopeWhere(session.user),
      },
      include: {
        equipment: { select: { name: true, siteId: true } },
        schedule: { include: { tasks: true } },
      },
    })

    if (
      !equipmentSchedule ||
      !canAccessSite(session.user, equipmentSchedule.equipment.siteId)
    ) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }
    if (equipmentSchedule.equipmentId !== equipmentId) {
      return NextResponse.json(
        { error: 'Schedule does not belong to this equipment' },
        { status: 400 }
      )
    }

    const validTaskIds = new Set(equipmentSchedule.schedule.tasks.map((task) => task.id))
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
        notes:
          typeof entryNotes === 'string' && entryNotes.trim()
            ? entryNotes.trim().slice(0, 1000)
            : null,
      })
    }

    const now = new Date()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    if (equipmentSchedule.lastCompleted && equipmentSchedule.lastCompleted >= today) {
      return NextResponse.json(
        { error: 'This schedule has already been completed today', duplicate: true },
        { status: 409 }
      )
    }

    const nextDue = calculateNextDueDate(equipmentSchedule.frequency, now)
    const result = await prisma.$transaction(async (tx) => {
      const advanced = await tx.equipmentSchedule.updateMany({
        where: { id: scheduleId, lastCompleted: equipmentSchedule.lastCompleted },
        data: {
          status: ScheduleStatus.PENDING,
          lastCompleted: now,
          nextDue,
        },
      })
      if (advanced.count === 0) return { duplicate: true as const }

      const completionLog = await tx.equipmentScheduleCompletionLog.create({
        data: {
          equipmentScheduleId: scheduleId,
          completedTasks: verifiedTasks,
          notes: notes || null,
          completedAt: now,
          equipmentName: equipmentSchedule.equipment.name,
          scheduleTitle: equipmentSchedule.schedule.title,
          // The log is the compliance record, so the sign-off has to land in it -
          // validating the signature and discarding it would leave the record unsigned.
          completedByUserId: session.user.id,
          signatureDataUrl: signOff.signatureDataUrl,
          signedName: signOff.signedName,
          signedAt: now,
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
        signedName: signOff.signedName,
      },
    })
  } catch (error) {
    console.error('Error completing equipment schedule:', error)
    return NextResponse.json({ error: 'Failed to complete schedule' }, { status: 500 })
  }
}
