import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const until = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        // Keep account in blocked state, but allow login for 10 minutes
        isBlocked: true,
        forcePasswordChange: true,
        temporaryUnblockUntil: until,
      },
      select: {
        id: true,
        email: true,
        isBlocked: true,
        forcePasswordChange: true,
        temporaryUnblockUntil: true,
      }
    })

    return NextResponse.json({
      message: 'User allowed to log in for 10 minutes and must change password on next login.',
      user,
    })
  } catch (error) {
    console.error('Unblock user error:', error)
    return NextResponse.json({ error: 'Failed to unblock user' }, { status: 500 })
  }
}


