// Single source of truth for the role hierarchy and per-site access rules.
//
// Hierarchy (highest first): OP > DIRECTOR > MANAGER > HEAD_OF_HOUSEKEEPING > CLEANER
//  - OP             -> top of the hierarchy, access to EVERY site (siteId = null)
//  - DIRECTOR       -> management dashboard, access to EVERY site (siteId = null)
//  - MANAGER        -> management dashboard, pinned to exactly one site
//  - HEAD_OF_HOUSEKEEPING -> site management/reporting plus the cleaning portal
//  - CLEANER        -> /clean only, pinned to exactly one site
//
// The legacy `isAdmin` boolean means "can reach the management area". Cleaning-portal
// access is a separate capability because Head of Housekeeping needs both surfaces.

export type Role = 'OP' | 'DIRECTOR' | 'MANAGER' | 'HEAD_OF_HOUSEKEEPING' | 'CLEANER'

export const ALL_ROLES: Role[] = ['OP', 'DIRECTOR', 'MANAGER', 'HEAD_OF_HOUSEKEEPING', 'CLEANER']

// Higher rank = more privilege.
export const ROLE_RANK: Record<Role, number> = {
  OP: 5,
  DIRECTOR: 4,
  MANAGER: 3,
  HEAD_OF_HOUSEKEEPING: 2,
  CLEANER: 1,
}

export const ROLE_LABELS: Record<Role, string> = {
  OP: 'OP',
  DIRECTOR: 'Director',
  MANAGER: 'Manager',
  HEAD_OF_HOUSEKEEPING: 'Head of Housekeeping',
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
  return roleRank(role) >= ROLE_RANK.HEAD_OF_HOUSEKEEPING
}

/** Roles allowed to carry out and sign off cleaning work. */
export function canUseCleaningPortal(role?: string | null): boolean {
  return role === 'HEAD_OF_HOUSEKEEPING' || role === 'CLEANER'
}

/** OP and DIRECTOR span every site; all operational roles are pinned to one. */
export function canAccessAllSites(role?: string | null): boolean {
  return roleRank(role) >= ROLE_RANK.DIRECTOR
}

/**
 * Whether `actorRole` may assign or manage `targetRole`.
 *
 * OP and above may act on roles at or below their own rank, so an OP can create another
 * OP - but not an OWNER, which outranks them. Everyone below OP may only touch roles
 * strictly beneath their own (a DIRECTOR manages site roles, never another
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
  return role === 'MANAGER' || role === 'HEAD_OF_HOUSEKEEPING' || role === 'CLEANER'
}
