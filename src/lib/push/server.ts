import 'server-only'

import webpush from 'web-push'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * Web push delivery.
 *
 * PRODUCTION IS NOT CONFIGURED BY THIS CODE. Push needs a VAPID key pair, which
 * is generated per deployment and kept out of the repository. Without one this
 * whole module reports itself unavailable and every path degrades to doing
 * nothing - the settings switch does not appear, subscribing is refused with an
 * explanation, and the scheduler sends nothing.
 *
 * To turn it on:
 *
 *   node -e "console.log(require('web-push').generateVAPIDKeys())"
 *
 * then set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (a mailto: or
 * https: URL identifying the deployment) in the environment. Do not commit them.
 * Rotating the pair invalidates every existing subscription, which is the
 * intended behaviour and the reason the keys are not derived from anything else.
 */

export interface PushPayload {
  title: string
  body: string
  /** Where clicking the notification should land. Same-origin path. */
  url?: string
  /** Groups replaceable notifications so five overdue alerts do not stack. */
  tag?: string
}

let configured: boolean | null = null

/**
 * Is push usable on this deployment?
 *
 * Deliberately checked lazily and cached: the answer cannot change without a
 * restart, and calling `setVapidDetails` with a malformed key throws.
 */
export function pushConfigured(): boolean {
  if (configured !== null) return configured

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim()

  if (!publicKey || !privateKey || !subject) {
    configured = false
    return false
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    configured = true
  } catch (error) {
    // A malformed key is a configuration mistake worth saying out loud once,
    // rather than failing on every notification for the life of the process.
    logger.error('[push] VAPID configuration is invalid; push is disabled', error)
    configured = false
  }

  return configured
}

/** Exposed for tests that swap the environment. */
export function resetPushConfigCache(): void {
  configured = null
}

/**
 * The public key a browser needs to subscribe. Safe to send to a client - that
 * is what it is for. Null when push is not configured, so the UI can say so
 * rather than offering a switch that cannot work.
 */
export function vapidPublicKey(): string | null {
  if (!pushConfigured()) return null
  return process.env.VAPID_PUBLIC_KEY?.trim() ?? null
}

export interface PushSendResult {
  sent: number
  /** Subscriptions the push service said are gone; these are deleted. */
  expired: number
  failed: number
}

/**
 * Push a payload to every device one person has consented on.
 *
 * Failure is per device. A dead endpoint on somebody's old phone must not stop
 * the notification reaching the tablet they are actually holding.
 */
export async function pushToUser(userId: string, payload: PushPayload): Promise<PushSendResult> {
  if (!pushConfigured()) return { sent: 0, expired: 0, failed: 0 }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })

  if (subscriptions.length === 0) return { sent: 0, expired: 0, failed: 0 }

  const body = JSON.stringify(payload)
  let sent = 0
  let expired = 0
  let failed = 0

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        body,
        // A notification about work due today is worthless tomorrow.
        { TTL: 12 * 60 * 60 }
      )

      sent++
      await prisma.pushSubscription.update({
        where: { id: subscription.id },
        data: { lastUsedAt: new Date(), failureCount: 0 },
      })
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode

      /*
       * 404 and 410 mean the push service has permanently dropped this
       * endpoint - the browser was uninstalled, the permission revoked, the
       * profile wiped. Keeping the row would mean retrying it forever, so it
       * goes. Anything else might be transient.
       */
      if (status === 404 || status === 410) {
        expired++
        await prisma.pushSubscription
          .delete({ where: { id: subscription.id } })
          .catch(() => undefined)
      } else {
        failed++
        await prisma.pushSubscription
          .update({
            where: { id: subscription.id },
            data: { failureCount: { increment: 1 } },
          })
          .catch(() => undefined)
        // No endpoint or key material in the log - it is per-device secret.
        logger.error(`[push] delivery failed with status ${status ?? 'unknown'}`)
      }
    }
  }

  return { sent, expired, failed }
}

/**
 * Push to several people at once, reporting the totals.
 */
export async function pushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<PushSendResult> {
  const totals: PushSendResult = { sent: 0, expired: 0, failed: 0 }

  for (const userId of userIds) {
    const result = await pushToUser(userId, payload)
    totals.sent += result.sent
    totals.expired += result.expired
    totals.failed += result.failed
  }

  return totals
}
