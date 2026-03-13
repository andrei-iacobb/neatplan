import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { checkRateLimitByUserOrIp } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 password change attempts per 15 minutes
    const rate = checkRateLimitByUserOrIp(request as any, 'change_password', 5, 15 * 60 * 1000)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { currentPassword, newPassword } = await request.json()
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Always require current password verification (even for force-change)
    // unless the user is in a force-password-change state from the DB
    const mustForceChange = user.forcePasswordChange === true
    if (!mustForceChange) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password required' }, { status: 400 })
      }
      const ok = await bcrypt.compare(currentPassword, user.password)
      if (!ok) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
      }
    } else {
      // Even in force-change, verify current password if provided
      if (currentPassword) {
        const ok = await bcrypt.compare(currentPassword, user.password)
        if (!ok) {
          return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
        }
      }
    }

    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        forcePasswordChange: false,
        isBlocked: false,
        temporaryUnblockUntil: null,
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
