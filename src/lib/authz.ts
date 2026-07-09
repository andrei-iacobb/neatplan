import { getServerSession } from 'next-auth/next'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'

export type SessionUser = {
  id: string
  email?: string | null
  name?: string | null
  isAdmin?: boolean
  role?: string
}

/**
 * Returns the authenticated session user, or null if there is no valid session.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions)
  return (session?.user as SessionUser | undefined) ?? null
}

type Guarded = { user: SessionUser } | { error: NextResponse }

/**
 * Require an authenticated user. Usage:
 *   const auth = await requireAuth()
 *   if ('error' in auth) return auth.error
 *   // auth.user is available
 */
export async function requireAuth(): Promise<Guarded> {
  const user = await getSessionUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { user }
}

/**
 * Require an authenticated user with admin privileges. Returns 401 when
 * unauthenticated and 403 when authenticated but not an admin.
 */
export async function requireAdmin(): Promise<Guarded> {
  const user = await getSessionUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!user.isAdmin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}
