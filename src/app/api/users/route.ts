import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { requireAdmin, resolveWriteSiteId, siteScopeWhere, resolveReadSiteId, readSiteWhere } from '@/lib/authz'
import { ALL_ROLES, canAssignRole, isManagementRole, requiresSite, type Role } from '@/lib/roles'

/** Narrow an arbitrary value to a valid Role. */
function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ALL_ROLES as string[]).includes(value)
}


export async function GET(request: Request) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error
    const actor = auth.user
    const requestedSiteId = new URL(request.url).searchParams.get('site')
    const siteId = resolveReadSiteId(actor, requestedSiteId)

    const users = await prisma.user.findMany({
      // Hidden owner accounts never appear in the directory, for anyone.
      where: {
        AND: [
          siteScopeWhere(actor),
          readSiteWhere(siteId),
          { isHidden: false },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        isAdmin: true,
        role: true,
        siteId: true,
        site: { select: { id: true, name: true } },
        isBlocked: true,
        forcePasswordChange: true,
        temporaryUnblockUntil: true,
      },
    })

    return NextResponse.json(users)

  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error
    const actor = auth.user

    const body = await request.json()
    const { name, email, password, role, siteId } = body

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate role
    if (!isRole(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Only allow assigning roles the actor has authority over.
    if (!canAssignRole(actor.role, role)) {
      return NextResponse.json(
        { error: 'You are not allowed to assign this role' },
        { status: 403 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password strength
    const { validatePassword } = await import('@/lib/password-policy')
    const pwResult = validatePassword(password)
    if (!pwResult.valid) {
      return NextResponse.json(
        { error: pwResult.errors[0] },
        { status: 400 }
      )
    }

    // Validate name length
    if (typeof name !== 'string' || name.length > 200) {
      return NextResponse.json(
        { error: 'Name must be 200 characters or less' },
        { status: 400 }
      )
    }

    // Resolve the site the new user belongs to. MANAGER/CLEANER must have one;
    // OP/DIRECTOR span every site and are forced to null.
    let resolvedSiteId: string | null = null
    if (requiresSite(role)) {
      resolvedSiteId = resolveWriteSiteId(actor, siteId)
      if (!resolvedSiteId) {
        return NextResponse.json(
          { error: 'A site is required for Manager and Cleaner roles' },
          { status: 400 }
        )
      }
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        isAdmin: isManagementRole(role),
        siteId: resolvedSiteId,
      }
    })

    // Don't return the password hash
    const { password: _, ...userWithoutPassword } = user
    return NextResponse.json(userWithoutPassword, { status: 201 })

  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
