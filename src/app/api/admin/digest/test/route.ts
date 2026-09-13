import { connection, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/authz'
import { emailService } from '@/lib/email'
import { buildDigest } from '@/lib/digest/build'
import { renderDigest } from '@/lib/digest/render'

/**
 * Send one digest, to the caller, now.
 *
 * The recipient is NOT a parameter. It is read from the session and can only
 * ever be the person asking - there is no shape of request that makes this send
 * to somebody else, which is the whole point of having a test path at all.
 *
 * Nothing is recorded against the week either, so a test send does not consume
 * Monday's real delivery.
 */
export async function POST() {
  await connection()

  const auth = await requireRole('HEAD_OF_HOUSEKEEPING')
  if ('error' in auth) return auth.error

  const me = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { email: true, notificationEmail: true, siteId: true },
  })

  if (!me) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  if (!me.siteId) {
    return NextResponse.json(
      { error: 'A test digest needs a site. Your account is not assigned to one.' },
      { status: 400 }
    )
  }

  if (!emailService.isReady()) {
    return NextResponse.json(
      {
        error:
          'Email is not configured on this server, so nothing was sent. Set the SMTP settings first.',
      },
      { status: 503 }
    )
  }

  const content = await buildDigest({ siteId: me.siteId })
  const rendered = renderDigest(content, process.env.NEXTAUTH_URL?.trim() || null)

  const to = me.notificationEmail?.trim() || me.email
  const delivered = await emailService.sendRawEmail({
    to,
    subject: `[Test] ${rendered.subject}`,
    html: rendered.html,
    text: rendered.text,
  })

  if (!delivered) {
    return NextResponse.json(
      { error: 'The mail server refused the message. Check the SMTP settings.' },
      { status: 502 }
    )
  }

  return NextResponse.json({
    sent: true,
    to,
    overdue: content.overdue.length,
    due: content.due.length,
  })
}
