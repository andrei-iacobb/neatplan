import { prisma } from '@/lib/db'
import { emailService } from '@/lib/email'
import { cleanupStaleSessions } from '@/lib/session-cleanup'
import { logger } from '@/lib/logger'

export type ScheduleCheckResult = {
  roomCount: number
  equipmentCount: number
  totalOverdue: number
  rearmedRoomSchedules: number
  sessionsCleaned: number
  emailsSent: number
  emailsFailed: number
}

/**
 * Core scheduled maintenance: mark overdue room/equipment schedules, clean up stale
 * sessions, and email admins when items newly go overdue. Invoked both by the HTTP cron
 * endpoint (external trigger) and by the in-process scheduler (self-hosted), so the two
 * deployment styles run identical logic.
 */
// Arbitrary app-wide key for the advisory lock serializing schedule checks.
const SCHEDULE_CHECK_LOCK_KEY = 727311

export async function runScheduleCheck(): Promise<ScheduleCheckResult> {
  const now = new Date()

  // The overdue and re-arm passes run inside one transaction guarded by a
  // transaction-scoped advisory lock, so an external cron hit overlapping an
  // in-process scheduler tick cannot interleave the passes (which would flip a
  // just-re-armed schedule straight to OVERDUE and email admins with no grace).
  // If another run holds the lock, this run reports zeros and does nothing.
  const transitions = await prisma.$transaction(async (tx) => {
    const [{ locked }] = await tx.$queryRaw<[{ locked: boolean }]>`
      SELECT pg_try_advisory_xact_lock(${SCHEDULE_CHECK_LOCK_KEY}) AS locked
    `
    if (!locked) return null

    const overdueRoomSchedules = await tx.roomSchedule.updateMany({
      where: {
        nextDue: { lt: now },
        // Only transition schedules that are not already OVERDUE (or COMPLETED). This means
        // `count` reflects schedules that JUST became overdue, so admins are alerted once on
        // the transition rather than re-alerted on every scheduler tick while items stay overdue.
        status: { notIn: ['COMPLETED', 'OVERDUE'] },
      },
      data: { status: 'OVERDUE' },
    })

    const overdueEquipmentSchedules = await tx.equipmentSchedule.updateMany({
      where: {
        nextDue: { lt: now },
        // Only transition schedules that are not already OVERDUE (or COMPLETED). This means
        // `count` reflects schedules that JUST became overdue, so admins are alerted once on
        // the transition rather than re-alerted on every scheduler tick while items stay overdue.
        status: { notIn: ['COMPLETED', 'OVERDUE'] },
      },
      data: { status: 'OVERDUE' },
    })

    // Re-arm completed room schedules whose next occurrence is due. This used to happen
    // as a side effect of GET /api/room-schedules; it lives here now so reads stay
    // read-only. Running AFTER the overdue pass gives freshly re-armed schedules one
    // scheduler interval as PENDING before they can be flagged overdue (and emailed).
    const rearmedRoom = await tx.roomSchedule.updateMany({
      where: {
        status: 'COMPLETED',
        nextDue: { lte: now },
      },
      data: { status: 'PENDING' },
    })

    return {
      roomCount: overdueRoomSchedules.count,
      equipmentCount: overdueEquipmentSchedules.count,
      rearmedRoomSchedules: rearmedRoom.count,
    }
  })

  const roomCount = transitions?.roomCount ?? 0
  const equipmentCount = transitions?.equipmentCount ?? 0
  const totalOverdue = roomCount + equipmentCount
  const rearmedRoomSchedules = transitions?.rearmedRoomSchedules ?? 0
  const sessionsCleaned = transitions ? await cleanupStaleSessions() : 0

  let emailsSent = 0
  let emailsFailed = 0

  // Send email alerts to admins if any items were newly marked overdue. A single failed
  // send must not abort the whole run or the other admins' alerts, so each is isolated.
  if (totalOverdue > 0) {
    const adminUsers = await prisma.user.findMany({ where: { isAdmin: true } })
    const message = `${roomCount} room schedule(s) and ${equipmentCount} equipment schedule(s) are now overdue. Please check the dashboard.`

    for (const admin of adminUsers) {
      try {
        await emailService.sendSystemAlert(admin.email, {
          userName: admin.name || 'Admin',
          alertType: 'Overdue Schedules',
          message,
        })
        emailsSent++
      } catch (err) {
        emailsFailed++
        logger.error('Failed to send overdue-schedule alert email', err)
      }
    }
  }

  return { roomCount, equipmentCount, totalOverdue, rearmedRoomSchedules, sessionsCleaned, emailsSent, emailsFailed }
}
