import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin, canAccessSite } from '@/lib/authz'
import { canAssignRole, type Role } from '@/lib/roles'


export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error
    const actor = auth.user

    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, role: true, siteId: true, isHidden: true },
    })
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Hidden owner accounts are not administrable by anyone else.
    if (target.isHidden) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Fail closed for users outside the actor's site (don't leak existence).
    if (!canAccessSite(actor, target.siteId)) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Must outrank the target to unblock it.
    if (!canAssignRole(actor.role, target.role as Role)) {
      return NextResponse.json(
        { error: 'You are not allowed to manage this user' },
        { status: 403 }
      )
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
