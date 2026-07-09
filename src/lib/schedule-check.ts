import { prisma } from '@/lib/db'
import { emailService } from '@/lib/email'
import { cleanupStaleSessions } from '@/lib/session-cleanup'
import { logger } from '@/lib/logger'

export type ScheduleCheckResult = {
  roomCount: number
  equipmentCount: number
  totalOverdue: number
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
export async function runScheduleCheck(): Promise<ScheduleCheckResult> {
  const now = new Date()

  const overdueRoomSchedules = await prisma.roomSchedule.updateMany({
    where: {
      nextDue: { lt: now },
      // Only transition schedules that are not already OVERDUE (or COMPLETED). This means
      // `count` reflects schedules that JUST became overdue, so admins are alerted once on
      // the transition rather than re-alerted on every scheduler tick while items stay overdue.
      status: { notIn: ['COMPLETED', 'OVERDUE'] },
    },
    data: { status: 'OVERDUE' },
  })

  const overdueEquipmentSchedules = await prisma.equipmentSchedule.updateMany({
    where: {
      nextDue: { lt: now },
      // Only transition schedules that are not already OVERDUE (or COMPLETED). This means
      // `count` reflects schedules that JUST became overdue, so admins are alerted once on
      // the transition rather than re-alerted on every scheduler tick while items stay overdue.
      status: { notIn: ['COMPLETED', 'OVERDUE'] },
    },
    data: { status: 'OVERDUE' },
  })

  const roomCount = overdueRoomSchedules.count
  const equipmentCount = overdueEquipmentSchedules.count
  const totalOverdue = roomCount + equipmentCount
  const sessionsCleaned = await cleanupStaleSessions()

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

  return { roomCount, equipmentCount, totalOverdue, sessionsCleaned, emailsSent, emailsFailed }
}
