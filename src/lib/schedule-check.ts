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

    // Capture the sites of schedules that are ABOUT to transition to OVERDUE (before the
    // updateMany flips their status out of the notIn filter below), so overdue alerts can be
    // routed to that site's manager(s) in addition to the OP/DIRECTOR roles that span every
    // site. Runs inside the advisory-lock transaction, so the set is stable against a
    // concurrent tick.
    const roomsGoingOverdue = await tx.roomSchedule.findMany({
      where: {
        nextDue: { lt: now },
        status: { notIn: ['COMPLETED', 'OVERDUE'] },
      },
      select: { room: { select: { siteId: true } } },
    })
    const equipmentGoingOverdue = await tx.equipmentSchedule.findMany({
      where: {
        nextDue: { lt: now },
        status: { notIn: ['COMPLETED', 'OVERDUE'] },
      },
      select: { equipment: { select: { siteId: true } } },
    })

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

    const overdueSiteIds = new Set<string>()
    for (const rs of roomsGoingOverdue) {
      if (rs.room?.siteId) overdueSiteIds.add(rs.room.siteId)
    }
    for (const es of equipmentGoingOverdue) {
      if (es.equipment?.siteId) overdueSiteIds.add(es.equipment.siteId)
    }

    return {
      roomCount: overdueRoomSchedules.count,
      equipmentCount: overdueEquipmentSchedules.count,
      rearmedRoomSchedules: rearmedRoom.count,
      overdueSiteIds: Array.from(overdueSiteIds),
    }
  })

  const roomCount = transitions?.roomCount ?? 0
  const equipmentCount = transitions?.equipmentCount ?? 0
  const totalOverdue = roomCount + equipmentCount
  const rearmedRoomSchedules = transitions?.rearmedRoomSchedules ?? 0
  const overdueSiteIds = transitions?.overdueSiteIds ?? []
  const sessionsCleaned = transitions ? await cleanupStaleSessions() : 0

  let emailsSent = 0
  let emailsFailed = 0

  // Send email alerts if any items were newly marked overdue. Route to everyone who can act
  // on the affected site(s): all OP and DIRECTOR users span every site, plus the MANAGER(s)
  // pinned to a site that just went overdue. Overdue items with no site (legacy/unassigned)
  // reach only OP/DIRECTOR, since no manager owns them. A single failed send must not abort
  // the whole run or the other recipients' alerts, so each is isolated.
  if (totalOverdue > 0) {
    const recipients = await prisma.user.findMany({
      where: {
        OR: [
          { role: { in: ['OP', 'DIRECTOR'] } },
          { role: 'MANAGER', siteId: { in: overdueSiteIds } },
        ],
      },
    })
    const message = `${roomCount} room schedule(s) and ${equipmentCount} equipment schedule(s) are now overdue. Please check the dashboard.`

    for (const recipient of recipients) {
      try {
        await emailService.sendSystemAlert(recipient.email, {
          userName: recipient.name || 'Admin',
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
