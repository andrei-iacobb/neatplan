import 'server-only'

import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { emailService } from '@/lib/email'
import { buildDigest, digestRecipients, type DigestRecipient } from './build'
import { renderDigest } from './render'
import { digestIsDue, digestWeek, DIGEST_TIMEZONE } from './week'

/**
 * Sending the weekly digest.
 *
 * Three things make this safe to run on a fifteen-minute timer:
 *
 *   1. It only sends to people who switched it on. Off by default, no exceptions.
 *   2. One row per person per week, with a unique constraint behind it, so a
 *      restart or an overlapping external cron cannot send twice.
 *   3. A failed attempt records the failure and leaves the row retryable, rather
 *      than marking the week done and losing it.
 */

export interface DigestSendResult {
  considered: number
  sent: number
  skipped: number
  failed: number
  /** False when the week's digest is not due yet, so nothing was attempted. */
  due: boolean
}

/**
 * How a digest actually goes out. Injectable so tests can assert on what WOULD
 * have been sent without a mail server anywhere near them.
 */
export type DigestTransport = (
  recipient: DigestRecipient,
  message: { subject: string; html: string; text: string }
) => Promise<boolean>

const defaultTransport: DigestTransport = async (recipient, message) =>
  emailService.sendRawEmail({
    to: recipient.email,
    subject: message.subject,
    html: message.html,
    text: message.text,
  })

function appUrl(): string | null {
  const configured = process.env.NEXTAUTH_URL?.trim()
  if (!configured) return null
  try {
    return new URL(configured).origin
  } catch {
    return null
  }
}

export interface RunDigestOptions {
  now?: Date
  timeZone?: string
  transport?: DigestTransport
  /**
   * Send even when the week's digest is not yet due. Only the manual preview and
   * test paths pass this; the scheduler never does.
   */
  force?: boolean
}

/**
 * Send this week's digest to everyone who has asked for it and not yet had it.
 */
export async function runWeeklyDigest({
  now = new Date(),
  timeZone = DIGEST_TIMEZONE,
  transport = defaultTransport,
  force = false,
}: RunDigestOptions = {}): Promise<DigestSendResult> {
  const week = digestWeek(now, timeZone)

  if (!force && !digestIsDue(now, timeZone)) {
    return { considered: 0, sent: 0, skipped: 0, failed: 0, due: false }
  }

  const recipients = await digestRecipients()
  if (recipients.length === 0) {
    return { considered: 0, sent: 0, skipped: 0, failed: 0, due: true }
  }

  const alreadyHandled = await prisma.weeklyDigestDelivery.findMany({
    where: {
      weekStart: week.key,
      userId: { in: recipients.map((recipient) => recipient.id) },
    },
    select: { userId: true, status: true },
  })

  // A previous FAILED attempt is retried; a SENT one is never repeated.
  const settled = new Set(
    alreadyHandled.filter((row) => row.status === 'SENT').map((row) => row.userId)
  )

  const url = appUrl()
  let sent = 0
  let failed = 0
  let skipped = 0

  // Built once per site, not once per recipient: two managers at one site get
  // the same digest, and rebuilding it would double the query load for nothing.
  const bySite = new Map<string, Awaited<ReturnType<typeof buildDigest>>>()

  for (const recipient of recipients) {
    if (settled.has(recipient.id)) {
      skipped++
      continue
    }

    try {
      let content = bySite.get(recipient.siteId)
      if (!content) {
        content = await buildDigest({ siteId: recipient.siteId, now, timeZone })
        bySite.set(recipient.siteId, content)
      }

      const message = renderDigest(content, url)
      const delivered = await transport(recipient, message)

      /*
       * Claiming the week happens AFTER the send, deliberately. Claiming first
       * would mean a crash between the claim and the send loses that person's
       * digest for the week with no way to notice. A duplicate is the lesser
       * failure than a silent miss, and the unique constraint keeps the window
       * to a single in-flight send.
       */
      await prisma.weeklyDigestDelivery.upsert({
        where: { userId_weekStart: { userId: recipient.id, weekStart: week.key } },
        create: {
          userId: recipient.id,
          weekStart: week.key,
          status: delivered ? 'SENT' : 'FAILED',
          error: delivered ? null : 'The mail service reported the send as unsuccessful.',
          dueCount: content.due.length,
          overdueCount: content.overdue.length,
        },
        update: {
          status: delivered ? 'SENT' : 'FAILED',
          error: delivered ? null : 'The mail service reported the send as unsuccessful.',
          attempts: { increment: 1 },
          dueCount: content.due.length,
          overdueCount: content.overdue.length,
        },
      })

      if (delivered) sent++
      else failed++
    } catch (error) {
      failed++
      // One bad recipient must not cost everyone else their digest.
      logger.error('[digest] failed to send weekly digest', error)

      await prisma.weeklyDigestDelivery
        .upsert({
          where: { userId_weekStart: { userId: recipient.id, weekStart: week.key } },
          create: {
            userId: recipient.id,
            weekStart: week.key,
            status: 'FAILED',
            error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error',
          },
          update: {
            status: 'FAILED',
            error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error',
            attempts: { increment: 1 },
          },
        })
        // Recording the failure is best effort; if the database is what broke,
        // the next tick will try the whole thing again anyway.
        .catch(() => undefined)
    }
  }

  return { considered: recipients.length, sent, skipped, failed, due: true }
}
