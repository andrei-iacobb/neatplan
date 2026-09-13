import { connection, NextResponse } from 'next/server'
import * as z from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/authz'
import { pushConfigured, vapidPublicKey } from '@/lib/push/server'
import { checkPushEndpoint } from '@/lib/push/endpoints'
import { logger } from '@/lib/logger'

/**
 * Browser push subscriptions.
 *
 * A subscription belongs to the person who created it and to nobody else. Every
 * operation here is scoped to the session; there is no request shape that
 * subscribes, inspects or removes somebody else's device.
 */

const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    // Base64url, produced by the browser. Bounded because they go straight into
    // a database column and there is no reason for them to be long.
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
})

/**
 * What the client needs to decide whether to offer the switch at all, and to
 * subscribe if the person says yes.
 */
export async function GET() {
  await connection()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const subscriptions = await prisma.pushSubscription.count({ where: { userId: auth.user.id } })

  return NextResponse.json({
    // Null when the deployment has no VAPID key pair. The UI says so rather than
    // offering a switch that cannot work.
    publicKey: vapidPublicKey(),
    configured: pushConfigured(),
    devices: subscriptions,
  })
}

export async function POST(request: Request) {
  await connection()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  if (!pushConfigured()) {
    return NextResponse.json(
      {
        error:
          'Push notifications are not set up on this server. Nothing was saved. An administrator needs to configure the VAPID keys first.',
      },
      { status: 503 }
    )
  }

  let parsed: z.infer<typeof subscribeSchema>
  try {
    parsed = subscribeSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'That subscription could not be read.' }, { status: 400 })
  }

  /*
   * The endpoint is a URL this server will POST to later, on a timer, without
   * being asked again. Checked before it is stored rather than before it is
   * used, so a rejected one never reaches the database at all.
   */
  const endpointCheck = checkPushEndpoint(parsed.endpoint)
  if (!endpointCheck.ok) {
    return NextResponse.json({ error: endpointCheck.reason }, { status: 400 })
  }

  const userAgent = request.headers.get('user-agent')?.slice(0, 200) ?? null

  /*
   * Keyed on the endpoint, which is unique per browser, so a device
   * re-subscribing - which browsers do on their own schedule - updates its row
   * rather than adding another and receiving every notification twice.
   */
  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint: parsed.endpoint },
    select: { userId: true, p256dh: true, auth: true },
  })

  /*
   * A row belonging to somebody else may only be taken over by a caller that can
   * present the browser's own key material.
   *
   * The legitimate case is a shared trolley tablet changing hands: the previous
   * cleaner signs out, the next signs in, and the one subscription that browser
   * holds should now be theirs. That browser still has the same p256dh and auth,
   * so it passes.
   *
   * Without the check, an endpoint alone would be enough to take it: the
   * attacker silences the other person AND has their own alerts delivered to
   * that person's device. An endpoint is not a secret to anyone who has seen it,
   * so "hard to obtain" is not a boundary worth relying on.
   */
  if (existing && existing.userId !== auth.user.id) {
    const sameDevice =
      existing.p256dh === parsed.keys.p256dh && existing.auth === parsed.keys.auth

    if (!sameDevice) {
      return NextResponse.json(
        { error: 'That subscription belongs to another device.' },
        { status: 409 }
      )
    }

    // A handover is legitimate but worth being able to see afterwards. No
    // endpoint or key material in the line - both are per-device secrets.
    logger.info(`[push] subscription reassigned to ${auth.user.id} on a shared device`)
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.endpoint },
    create: {
      userId: auth.user.id,
      endpoint: parsed.endpoint,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
      userAgent,
    },
    update: {
      userId: auth.user.id,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
      userAgent,
      failureCount: 0,
    },
  })

  return NextResponse.json({ subscribed: true })
}

export async function DELETE(request: Request) {
  await connection()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const endpoint = new URL(request.url).searchParams.get('endpoint')

  /*
   * Scoped to the caller. Without the userId clause, knowing somebody else's
   * endpoint would be enough to silence their notifications - and an endpoint is
   * not a secret to the browser that holds it.
   *
   * No endpoint means "this account, everywhere", which is what turning the
   * switch off on a device you no longer have should do.
   */
  const result = await prisma.pushSubscription.deleteMany({
    where: {
      userId: auth.user.id,
      ...(endpoint ? { endpoint } : {}),
    },
  })

  return NextResponse.json({ removed: result.count })
}
