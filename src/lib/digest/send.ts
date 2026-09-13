import 'server-only'

import { prisma } from '@/lib/db'
import { Prisma } from '@/generated/prisma/client'
import { logger } from '@/lib/logger'
import { emailService } from '@/lib/email'
import { buildDigest, digestRecipients, type DigestRecipient } from './build'
import { renderDigest } from './render'
import { digestIsDue, digestWeek, DIGEST_TIMEZONE } from './week'

/**
 * Sending the weekly digest.
 *
 * Safe to run on a fifteen-minute timer, and safe to run twice at once - which
 * it will be, because the in-process scheduler and the external cron endpoint
 * both call it and nothing stops them landing in the same minute.
 *
 * The delivery row is CLAIMED before the send, not written after it. An earlier
 * version did the opposite, reasoning that a crash between claiming and sending
 * would lose somebody's week. It would - but writing afterwards means two
 * concurrent runners both find no row, both send, and only then write. Two real
 * emails to a manager is a worse failure than one late one, and the claim is the
 * only thing that can prevent it.
 *
 * The crash case is handled instead by the claim being reclaimable: a row left
 * PENDING by a process that died becomes available again after STALE_CLAIM_MINUTES.
 *
 * What remains is a genuine at-least-once window: if the send succeeds and the
 * status write then fails, the row stays PENDING and a later tick resends. That
 * is a narrow window - a database failing in the moment between two adjacent
 * statements - and it is the honest trade. It is not hidden.
 */

/**
 * How long a claim can sit unfinished before another runner may take it.
 *
 * Long enough that a transient database problem resolves before a retry is
 * attempted, short enough that a crashed Monday send still goes out on Monday.
 */
const STALE_CLAIM_MINUTES = 60

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

/**
 * Take exclusive ownership of one person's week, or report that somebody else
 * has it.
 *
 * Two ways to win it. Creating the row outright is the common path; the unique
 * constraint on (userId, weekStart) means exactly one concurrent runner can do
 * that and the rest get P2002. Failing that, an existing row may be taken over
 * if it FAILED, or if it has been PENDING longer than the stale window - which
 * means whoever claimed it died before finishing.
 *
 * `updateMany` with the condition in the WHERE is what makes the takeover
 * atomic: two runners racing for the same stale row produce one count of 1 and
 * one count of 0.
 */
async function claimWeek(userId: string, weekStart: string, staleBefore: Date): Promise<boolean> {
  try {
    await prisma.weeklyDigestDelivery.create({
      data: { userId, weekStart, status: 'PENDING' },
    })
    return true
  } catch (error) {
    const isConflict =
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    if (!isConflict) throw error
  }

  const takeover = await prisma.weeklyDigestDelivery.updateMany({
    where: {
      userId,
      weekStart,
      OR: [{ status: 'FAILED' }, { status: 'PENDING', updatedAt: { lt: staleBefore } }],
    },
    data: { status: 'PENDING', attempts: { increment: 1 }, error: null },
  })

  return takeover.count === 1
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

  const url = appUrl()
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MINUTES * 60_000)
  let sent = 0
  let failed = 0
  let skipped = 0

  // Built once per site, not once per recipient: two managers at one site get
  // the same digest, and rebuilding it would double the query load for nothing.
  const bySite = new Map<string, Awaited<ReturnType<typeof buildDigest>>>()

  for (const recipient of recipients) {
    const claimed = await claimWeek(recipient.id, week.key, staleBefore)
    if (!claimed) {
      // Already sent, or another runner is sending it right now. Either way this
      // run must not send it again.
      skipped++
      continue
    }

    let delivered = false
    let failure: string | null = null

    try {
      let content = bySite.get(recipient.siteId)
      if (!content) {
        content = await buildDigest({ siteId: recipient.siteId, now, timeZone })
        bySite.set(recipient.siteId, content)
      }

      const message = renderDigest(content, url)
      delivered = await transport(recipient, message)
      if (!delivered) failure = 'The mail service reported the send as unsuccessful.'

      await prisma.weeklyDigestDelivery.update({
        where: { userId_weekStart: { userId: recipient.id, weekStart: week.key } },
        data: {
          status: delivered ? 'SENT' : 'FAILED',
          error: failure,
          dueCount: content.due.length,
          overdueCount: content.overdue.length,
        },
      })
    } catch (error) {
      // One bad recipient must not cost everyone else their digest.
      failure = error instanceof Error ? error.message.slice(0, 500) : 'Unknown error'
      logger.error('[digest] failed to send weekly digest', error)

      await prisma.weeklyDigestDelivery
        .update({
          where: { userId_weekStart: { userId: recipient.id, weekStart: week.key } },
          /*
           * Only ever recorded as FAILED when the send itself did not succeed.
           * Marking a delivered digest FAILED would make it retryable and send
           * the same person a second copy - the exact thing the claim exists to
           * prevent.
           */
          data: delivered
            ? { status: 'SENT', error: null }
            : { status: 'FAILED', error: failure },
        })
        // Best effort. If the database is what broke, the claim stays PENDING
        // and becomes retryable on its own after the stale window.
        .catch(() => undefined)
    }

    if (delivered) sent++
    else failed++
  }

  return { considered: recipients.length, sent, skipped, failed, due: true }
}
