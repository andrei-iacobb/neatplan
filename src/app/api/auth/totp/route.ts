import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generateTotpSecret, getTotpUri, verifyTotp } from '@/lib/totp'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { totpEnabled: true, isAdmin: true },
    })

    return NextResponse.json({
      enabled: user?.totpEnabled ?? false,
      available: user?.isAdmin ?? false,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch 2FA status' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, isAdmin: true, totpEnabled: true, totpSecret: true },
    })

    if (!user?.isAdmin) {
      return NextResponse.json({ error: '2FA is only available for admin accounts' }, { status: 403 })
    }

    const body = await request.json()
    const { action, token, password } = body

    if (action === 'setup') {
      const secret = generateTotpSecret()
      await prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: secret, totpEnabled: false },
      })
      return NextResponse.json({
        secret,
        uri: getTotpUri(user.email, secret),
      })
    }

    if (action === 'enable') {
      if (!user.totpSecret || !token) {
        return NextResponse.json({ error: 'Token required' }, { status: 400 })
      }
      if (!verifyTotp(user.totpSecret, token)) {
        return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { totpEnabled: true },
      })
      return NextResponse.json({ enabled: true })
    }

    if (action === 'disable') {
      if (!token) {
        return NextResponse.json({ error: 'Token required' }, { status: 400 })
      }
      if (!user.totpSecret || !verifyTotp(user.totpSecret, token)) {
        return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { totpEnabled: false, totpSecret: null },
      })
      return NextResponse.json({ enabled: false })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Failed to update 2FA settings' }, { status: 500 })
  }
}
