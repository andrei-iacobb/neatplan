import { prisma } from '@/lib/db'
import { resolveReadSiteId, type SessionUser } from '@/lib/authz'
import { canAccessAllSites } from '@/lib/roles'
import type { ExportFilterChip } from './types'

export interface SiteContext {
  /** null means "every site the caller may see" - only reachable by OP/DIRECTOR. */
  siteId: string | null
  /** What the document header says, e.g. "Beech House" or "All sites". */
  label: string
}

/**
 * The site a document covers, resolved through the same helper the read APIs
 * use. A pinned role never widens its scope by passing `?site=`; the requested
 * value is simply not read for them.
 */
export async function resolveSiteContext(
  user: SessionUser,
  params: URLSearchParams
): Promise<SiteContext> {
  const siteId = resolveReadSiteId(user, params.get('site'))

  if (!siteId) return { siteId: null, label: 'All sites' }

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { name: true },
  })

  // A pinned user with a deleted or missing site still gets a scoped query; the
  // header just cannot name it. Better than printing a raw cuid.
  return { siteId, label: site?.name ?? (canAccessAllSites(user.role) ? 'Unknown site' : 'Your site') }
}

/**
 * Inclusive date window from `from`/`to` query params. `to` is pushed to the end
 * of its day so "to 13 Sep" includes work completed at 16:40 on the 13th.
 */
export function parseDateWindow(params: URLSearchParams, fromKey = 'dateFrom', toKey = 'dateTo') {
  const fromRaw = params.get(fromKey)
  const toRaw = params.get(toKey)

  const from = fromRaw ? new Date(fromRaw) : null
  const to = toRaw ? new Date(toRaw) : null

  if (to && !Number.isNaN(to.getTime())) to.setHours(23, 59, 59, 999)

  return {
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    to: to && !Number.isNaN(to.getTime()) ? to : null,
  }
}

/** Prisma `gte`/`lte` fragment, or undefined when neither bound was given. */
export function dateWindowWhere(window: { from: Date | null; to: Date | null }) {
  if (!window.from && !window.to) return undefined
  return {
    ...(window.from ? { gte: window.from } : {}),
    ...(window.to ? { lte: window.to } : {}),
  }
}

/**
 * Builds the "what produced this document" chips. Only non-empty filters appear,
 * so an unfiltered export does not print a wall of "Any".
 */
export function buildFilterChips(entries: Array<[string, string | null | undefined]>): ExportFilterChip[] {
  return entries
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([label, value]) => ({ label, value }))
}

/** Human label for a date window, for the header chips. */
export function describeDateWindow(window: { from: Date | null; to: Date | null }): string | null {
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  if (window.from && window.to) return `${fmt(window.from)} to ${fmt(window.to)}`
  if (window.from) return `From ${fmt(window.from)}`
  if (window.to) return `Up to ${fmt(window.to)}`
  return null
}

/**
 * Case-insensitive substring match against a free-text search box. Returns
 * undefined when the box is empty so the caller can spread it away.
 */
export function searchTerm(params: URLSearchParams, key = 'q'): string | undefined {
  const value = params.get(key)?.trim()
  return value ? value : undefined
}
