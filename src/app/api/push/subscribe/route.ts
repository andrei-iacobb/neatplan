import { connection, NextResponse } from 'next/server'
import * as z from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/authz'
import { pushConfigured, vapidPublicKey } from '@/lib/push/server'

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

  const userAgent = request.headers.get('user-agent')?.slice(0, 200) ?? null

  /*
   * Keyed on the endpoint, which is unique per browser. A device re-subscribing
   * - which browsers do on their own schedule - updates its row rather than
   * adding another, so nobody ends up receiving the same notification five
   * times. The update also re-points the row at the current user, which is what
   * should happen when a shared tablet changes hands.
   */
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
