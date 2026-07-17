import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { requireAdmin, canAccessSite, resolveWriteSiteId } from '@/lib/authz'
import { ALL_ROLES, isManagementRole, requiresSite, roleRank, type Role } from '@/lib/roles'

/** Narrow an arbitrary value to a valid Role. */
function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ALL_ROLES as string[]).includes(value)
}

/**
 * Whether `actorRole` is allowed to assign/manage `targetRole`.
 * OP may manage anything; everyone else may only touch roles strictly below
 * their own rank.
 */
function canAssignRole(actorRole: string | null | undefined, targetRole: Role): boolean {
  if (actorRole === 'OP') return true
  return roleRank(targetRole) < roleRank(actorRole)
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error
    const actor = auth.user

    const { id } = params
    const body = await request.json()
    const { name, email, password, role, siteId, isBlocked, forcePasswordChange } = body

    // Load the target so we can enforce site scoping and role authority.
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, siteId: true },
    })
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isSelf = actor.id === id

    if (isSelf) {
      // Users may edit their own name/email/password, but never elevate
      // themselves or change their own site/blocked status.
      if (role !== undefined || siteId !== undefined || isBlocked !== undefined) {
        return NextResponse.json(
          { error: 'Cannot modify your own role, site or blocked status' },
          { status: 403 }
        )
      }
    } else {
      // Fail closed for anyone editing a user outside their site (don't leak existence).
      if (!canAccessSite(actor, target.siteId)) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      // The actor must outrank the target's current role to touch it at all.
      if (!canAssignRole(actor.role, target.role as Role)) {
        return NextResponse.json(
          { error: 'You are not allowed to manage this user' },
          { status: 403 }
        )
      }
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }
    }

    // Validate password strength if provided
    if (password) {
      const { validatePassword } = await import('@/lib/password-policy')
      const pwResult = validatePassword(password)
      if (!pwResult.valid) {
        return NextResponse.json({ error: pwResult.errors[0] }, { status: 400 })
      }
    }

    // Validate name length if provided
    if (name && (typeof name !== 'string' || name.length > 200)) {
      return NextResponse.json({ error: 'Name must be 200 characters or less' }, { status: 400 })
    }

    const dataToUpdate: Record<string, unknown> = {}
    if (name !== undefined) dataToUpdate.name = name
    if (email !== undefined) dataToUpdate.email = email
    if (isBlocked !== undefined) dataToUpdate.isBlocked = Boolean(isBlocked)
    if (forcePasswordChange !== undefined) dataToUpdate.forcePasswordChange = Boolean(forcePasswordChange)

    // Role change: validate and require authority over the *new* role too.
    if (role !== undefined) {
      if (!isRole(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      if (!canAssignRole(actor.role, role)) {
        return NextResponse.json(
          { error: 'You are not allowed to assign this role' },
          { status: 403 }
        )
      }
      dataToUpdate.role = role
      dataToUpdate.isAdmin = isManagementRole(role)
    }

    // Resolve the site whenever the role or the site is being changed.
    if (role !== undefined || siteId !== undefined) {
      const effectiveRole = (role !== undefined ? role : target.role) as Role
      if (requiresSite(effectiveRole)) {
        const requested = siteId !== undefined ? siteId : target.siteId
        const resolved = resolveWriteSiteId(actor, requested)
        if (!resolved) {
          return NextResponse.json(
            { error: 'A site is required for Manager and Cleaner roles' },
            { status: 400 }
          )
        }
        dataToUpdate.siteId = resolved
      } else {
        // OP/DIRECTOR span every site.
        dataToUpdate.siteId = null
      }
    }

    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, 12)
    }

    const user = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    })

    const { password: _, ...userWithoutPassword } = user
    return NextResponse.json(userWithoutPassword)

  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error
    const actor = auth.user

    const { id } = params

    // Prevent deleting your own account.
    if (actor.id === id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 403 })
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, siteId: true },
    })
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Site scoping - don't leak users outside the actor's site.
    if (!canAccessSite(actor, target.siteId)) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Must outrank the target to delete it.
    if (!canAssignRole(actor.role, target.role as Role)) {
      return NextResponse.json(
        { error: 'You are not allowed to delete this user' },
        { status: 403 }
      )
    }

    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'User deleted successfully' })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
