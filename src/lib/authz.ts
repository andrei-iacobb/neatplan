import { getServerSession } from 'next-auth/next'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { canAccessAllSites, hasMinRole, type Role } from '@/lib/roles'

export type SessionUser = {
  id: string
  email?: string | null
  name?: string | null
  isAdmin?: boolean
  role?: string
  siteId?: string | null
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

/**
 * Require an authenticated user of at least `min` role in the hierarchy
 * (OP > DIRECTOR > MANAGER > CLEANER). Use for actions that must be limited
 * above the management line, e.g. site CRUD or assigning Director/OP.
 */
export async function requireRole(min: Role): Promise<Guarded> {
  const user = await getSessionUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  if (!hasMinRole(user.role, min)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { user }
}

// A siteId value that can never match a real cuid, used to force an empty result
// set when a site-pinned user somehow has no site assigned (fail closed).
const NO_SITE = '__no_site__'

/**
 * Prisma `where` fragment that limits a query on a model with a direct `siteId`
 * column (Room, Equipment, Schedule, CleaningTask) to the sites this user may see.
 *   - OP / DIRECTOR -> {} (all sites)
 *   - MANAGER / CLEANER -> { siteId: <their site> } (fails closed if unassigned)
 */
export function siteScopeWhere(user: SessionUser): { siteId?: string } {
  if (canAccessAllSites(user.role)) return {}
  return { siteId: user.siteId ?? NO_SITE }
}

/**
 * Like siteScopeWhere but for models that reach their site through a named
 * relation (e.g. RoomSchedule -> room, RoomScheduleCompletionLog -> roomSchedule.room).
 * Pass the relation path, e.g. nestedSiteScopeWhere(user, 'room') => { room: { siteId } }.
 */
export function nestedSiteScopeWhere(user: SessionUser, relation: string): Record<string, unknown> {
  if (canAccessAllSites(user.role)) return {}
  return { [relation]: { siteId: user.siteId ?? NO_SITE } }
}

/**
 * The site a READ should be narrowed to, given what the caller asked for.
 *
 * `resolveWriteSiteId` already does this for writes; reads had no equivalent, so every
 * read helper derived the site purely from the session and could not express "this user
 * asked to look at site X".
 *
 * For a pinned role the requested value is never read, so a crafted id cannot reach
 * Prisma - a MANAGER passing another site's id simply gets their own data. That is the
 * same convention the write side already uses, rather than a second one. Returning
 * NO_SITE for an unassigned pinned user keeps siteScopeWhere's fail-closed behaviour.
 */
export function resolveReadSiteId(user: SessionUser, requested?: string | null): string | null {
  if (!canAccessAllSites(user.role)) return user.siteId ?? NO_SITE
  if (!requested || requested === 'all') return null
  return requested
}

/** Direct `siteId` column (User, Room, Equipment). `{}` when unfiltered. */
export function readSiteWhere(siteId: string | null): { siteId?: string } {
  return siteId ? { siteId } : {}
}

/** Site reached through a named relation, e.g. RoomSchedule -> room. */
export function nestedReadSiteWhere(siteId: string | null, relation: string): Record<string, unknown> {
  return siteId ? { [relation]: { siteId } } : {}
}

/** Many-to-many site links (Schedule). */
export function m2mReadSiteWhere(siteId: string | null, relation = 'sites'): Record<string, unknown> {
  return siteId ? { [relation]: { some: { id: siteId } } } : {}
}

/** Whether this user may read/write data belonging to `siteId`. */
export function canAccessSite(user: SessionUser, siteId: string | null | undefined): boolean {
  if (canAccessAllSites(user.role)) return true
  return !!siteId && user.siteId === siteId
}

/**
 * The siteId a create/write should be stamped with.
 *   - MANAGER / CLEANER -> forced to their own site (request value ignored)
 *   - OP / DIRECTOR -> the requested site (may be null; caller decides if required)
 */
export function resolveWriteSiteId(user: SessionUser, requestedSiteId?: string | null): string | null {
  if (!canAccessAllSites(user.role)) return user.siteId ?? null
  return requestedSiteId ?? null
}

// ---- Many-to-many site scoping (Schedule <-> Site) -------------------------

/**
 * Prisma `where` fragment for a model that reaches sites through a many-to-many
 * relation (Schedule.sites). OP/DIRECTOR -> {} (all); MANAGER/CLEANER -> only
 * rows linked to their own site. Fails closed when a pinned user has no site.
 */
export function m2mSiteScopeWhere(user: SessionUser, relation = 'sites'): Record<string, unknown> {
  if (canAccessAllSites(user.role)) return {}
  return { [relation]: { some: { id: user.siteId ?? NO_SITE } } }
}

/** Whether the user may access a record linked to this set of sites (m2m). */
export function canAccessAnySite(user: SessionUser, siteIds: (string | null | undefined)[]): boolean {
  if (canAccessAllSites(user.role)) return true
  return !!user.siteId && siteIds.includes(user.siteId)
}

/**
 * `where` filter for INCLUDING a record's m2m `sites` relation without leaking
 * sites the caller can't see. A MANAGER/CLEANER who can reach a schedule shared
 * across sites must not learn the other sites' names, so their view of the
 * relation is narrowed to their own site. OP/DIRECTOR see all (undefined = no filter).
 */
export function visibleSiteRelationWhere(user: SessionUser): { id: string } | undefined {
  if (canAccessAllSites(user.role)) return undefined
  return { id: user.siteId ?? NO_SITE }
}

/**
 * The set of siteIds a create/write should be linked to.
 *   - MANAGER / CLEANER -> forced to exactly their own site (request ignored)
 *   - OP / DIRECTOR -> the requested sites (deduped; may be empty - caller decides if required)
 */
export function resolveWriteSiteIds(user: SessionUser, requestedSiteIds?: string[] | null): string[] {
  if (!canAccessAllSites(user.role)) return user.siteId ? [user.siteId] : []
  return Array.from(new Set((requestedSiteIds ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0)))
}

/**
 * Whether the user may mutate (write/delete) a schedule. Only applies to mutations;
 * read access uses canAccessAnySite.
 *
 * MANAGER/CLEANER may only mutate schedules linked to exactly ONE site (their own).
 * If a schedule is shared across multiple sites, only OP/DIRECTOR may mutate it.
 *
 * This prevents a MANAGER pinned to site A from destroying operational data when
 * a schedule is shared with site B (though they read it via canAccessAnySite).
 */
export function canMutateSchedule(user: SessionUser, schedule: { sites: { id: string }[] }): boolean {
  if (canAccessAllSites(user.role)) return true

  // MANAGER/CLEANER can only mutate if the schedule is linked to exactly their own site.
  if (schedule.sites.length !== 1) return false
  return schedule.sites[0].id === user.siteId
}
