// Single source of truth for the role hierarchy and per-site access rules.
//
// Hierarchy (highest first): OP > DIRECTOR > MANAGER > CLEANER
//  - OP             -> top of the hierarchy, access to EVERY site (siteId = null)
//  - DIRECTOR       -> management dashboard, access to EVERY site (siteId = null)
//  - MANAGER        -> management dashboard, pinned to exactly one site
//  - CLEANER        -> /clean only, pinned to exactly one site
//
// The legacy `isAdmin` boolean now means "is a management role" (anything but CLEANER).

export type Role = 'OP' | 'DIRECTOR' | 'MANAGER' | 'CLEANER'

export const ALL_ROLES: Role[] = ['OP', 'DIRECTOR', 'MANAGER', 'CLEANER']

// Higher rank = more privilege.
export const ROLE_RANK: Record<Role, number> = {
  OP: 4,
  DIRECTOR: 3,
  MANAGER: 2,
  CLEANER: 1,
}

export const ROLE_LABELS: Record<Role, string> = {
  OP: 'OP',
  DIRECTOR: 'Director',
  MANAGER: 'Manager',
  CLEANER: 'Cleaner',
}

export function roleRank(role?: string | null): number {
  return ROLE_RANK[(role as Role)] ?? 0
}

/** True when `role` is at least `min` in the hierarchy. */
export function hasMinRole(role: string | null | undefined, min: Role): boolean {
  return roleRank(role) >= ROLE_RANK[min]
}

/** Roles that can reach the management area. This is what `isAdmin` now encodes. */
export function isManagementRole(role?: string | null): boolean {
  return roleRank(role) >= ROLE_RANK.MANAGER
}

/** OP and DIRECTOR span every site; MANAGER and CLEANER are pinned to one. */
export function canAccessAllSites(role?: string | null): boolean {
  return roleRank(role) >= ROLE_RANK.DIRECTOR
}

/**
 * Whether `actorRole` may assign or manage `targetRole`.
 *
 * OP and above may act on roles at or below their own rank, so an OP can create another
 * OP - but not an OWNER, which outranks them. Everyone below OP may only touch roles
 * strictly beneath their own (a DIRECTOR manages MANAGER/CLEANER, never another
 * DIRECTOR).
 */
export function canAssignRole(actorRole: string | null | undefined, targetRole: Role): boolean {
  if (roleRank(actorRole) >= ROLE_RANK.OP) {
    return roleRank(targetRole) <= roleRank(actorRole)
  }
  return roleRank(targetRole) < roleRank(actorRole)
}

/** A user pinned to a single site must have one assigned. */
export function requiresSite(role?: string | null): boolean {
  return role === 'MANAGER' || role === 'CLEANER'
}
