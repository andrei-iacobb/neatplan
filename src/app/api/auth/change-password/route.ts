import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { currentPassword, newPassword } = await request.json()
    const mustChangeFromSession = (session.user as any)?.forcePasswordChange === true
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If either session indicates forced change OR user row indicates forced change,
    // do not require current password. Otherwise, verify current password.
    if (!(mustChangeFromSession || user.forcePasswordChange)) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Current password required' }, { status: 400 })
      }
      const ok = await bcrypt.compare(currentPassword, user.password)
      if (!ok) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
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


