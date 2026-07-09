import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'
import { calculateNextDueDate } from '@/lib/schedule-utils'
import { ScheduleStatus } from '@prisma/client'

// PATCH /api/rooms/[id]/schedules/[scheduleId] - Admin marks a room schedule complete.
// NOTE: the [scheduleId] path segment carries the RoomSchedule row id (the admin UI
// passes roomSchedule.id here), not the underlying Schedule id.
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; scheduleId: string }> }
) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const { id: roomId, scheduleId: roomScheduleId } = await context.params

    let notes = ''
    try {
      const body = await request.json()
      notes = typeof body?.notes === 'string' ? body.notes : ''
    } catch {
      notes = ''
    }

    const now = new Date()

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.roomSchedule.findUnique({
        where: { id: roomScheduleId },
        include: {
          room: { select: { name: true } },
          schedule: { select: { title: true } },
        },
      })
      if (!current || current.roomId !== roomId) {
        return { notFound: true as const }
      }

      // Optimistic concurrency guard: only one of several concurrent completions
      // advances the cycle. The update matches on the lastCompleted value we just
      // read; the loser sees count === 0 and is treated as an idempotent no-op.
      const advanced = await tx.roomSchedule.updateMany({
        where: { id: roomScheduleId, lastCompleted: current.lastCompleted },
        data: {
          lastCompleted: now,
          nextDue: calculateNextDueDate(current.frequency as any, now),
          status: ScheduleStatus.PENDING,
        },
      })

      if (advanced.count === 0) {
        return { duplicate: true as const }
      }

      await tx.roomScheduleCompletionLog.create({
        data: {
          roomScheduleId,
          completedAt: now,
          notes: notes || null,
          completedByUserId: auth.user.id,
          // Snapshot identifying info so the record survives room/schedule deletion.
          roomName: current.room?.name ?? null,
          scheduleTitle: current.schedule?.title ?? null,
        },
      })

      const updated = await tx.roomSchedule.findUnique({
        where: { id: roomScheduleId },
        include: { room: true, schedule: { include: { tasks: true } } },
      })

      return { updated }
    })

    if ('notFound' in result) {
      return NextResponse.json({ error: 'Room schedule not found' }, { status: 404 })
    }
    if ('duplicate' in result) {
      return NextResponse.json(
        { error: 'Schedule already completed', duplicate: true },
        { status: 409 }
      )
    }

    return NextResponse.json(result.updated)
  } catch (error) {
    console.error('Error completing room schedule:', error)
    return NextResponse.json({ error: 'Failed to complete schedule' }, { status: 500 })
  }
}
