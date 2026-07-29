'use client'

/**
 * Owns the dashboard's "which site am I looking at" selection.
 *
 * The URL query param `?site=` is the single source of truth. localStorage is
 * a sticky default only: it is read when the URL is silent and written on
 * every change. Nothing else in the app may hold this value, otherwise two
 * copies drift and the KPI tiles disagree with the chart beside them.
 *
 * The server is the thing that actually filters (three of the seven dashboard
 * endpoints cannot be filtered in the browser at all), so this hook only ever
 * produces an id to hand to the fetches.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { canAccessAllSites } from '@/lib/roles'
import { useToast } from '@/components/ui/toast-context'
import { apiRequest } from '@/lib/url-utils'

export const ALL_SITES = 'all'
export const SITE_PARAM = 'site'

const STORAGE_KEY = 'neatplan-dashboard-site'
const RECENTS_KEY = 'neatplan-dashboard-site-recents'
const RECENTS_LIMIT = 3

/**
 * The site created by 20260728180000_add_sites_rbac_and_signoff to hold rows
 * that pre-date multi-site support. It is a real site with real rows, so it is
 * listed - but it sorts last, reads muted, and is never a sticky default or a
 * recent, because selecting it is a cleanup workflow rather than a normal view.
 */
export const LEGACY_SITE_ID = 'site_legacy_backfill'
export const LEGACY_SITE_HINT =
  'Holds records that pre-date multi-site support. Reassign them to real sites, then delete this site.'

export interface SiteOption {
  id: string
  name: string
  address: string | null
  /** True for the legacy backfill site. Drives sort order and muted styling. */
  isLegacy: boolean
}

function readKey(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeKey(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    /* private mode, quota - a sticky default is not worth throwing over */
  }
}

function readRecents(): string[] {
  const raw = readKey(RECENTS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

/** Sites arrive name-ascending from the API; only the legacy site is re-ranked. */
function normaliseSites(raw: unknown): SiteOption[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((s: any) => s && typeof s.id === 'string' && typeof s.name === 'string')
    .map((s: any) => ({
      id: s.id,
      name: s.name,
      address: typeof s.address === 'string' ? s.address : null,
      isLegacy: s.id === LEGACY_SITE_ID,
    }))
    .sort((a, b) => {
      if (a.isLegacy !== b.isLegacy) return a.isLegacy ? 1 : -1
      return a.name.localeCompare(b.name)
    })
}

export interface SiteFilterState {
  sites: SiteOption[]
  /** `all` or a site id. Always reflects the URL once resolution has settled. */
  selected: string
  selectedSite: SiteOption | null
  setSelected: (value: string) => void
  /** OP and DIRECTOR choose; MANAGER and CLEANER are pinned by the server. */
  canPick: boolean
  /** Site ids most recently chosen, newest first. Only used past 25 sites. */
  recents: string[]
  /**
   * False until the sticky default has been applied and - when a specific site
   * is in play - the sites list has confirmed it exists. Gate the first data
   * fetch on this so a deep link does not fetch twice.
   */
  ready: boolean
}

export function useSiteFilter(): SiteFilterState {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { showToast } = useToast()

  const urlSite = searchParams.get(SITE_PARAM)
  const canPick = canAccessAllSites(session?.user?.role)

  const [sticky, setSticky] = useState<string | null>(null)
  const [stickyResolved, setStickyResolved] = useState(false)
  const [sites, setSites] = useState<SiteOption[]>([])
  // Two flags, because "the list came back empty" and "the list never came
  // back" must not be treated the same. Only the first is authoritative enough
  // to declare a selected site gone.
  const [sitesSettled, setSitesSettled] = useState(false)
  const [sitesOk, setSitesOk] = useState(false)
  const [recents, setRecents] = useState<string[]>([])

  const selected = urlSite ?? sticky ?? ALL_SITES

  const buildUrl = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === ALL_SITES) params.delete(SITE_PARAM)
      else params.set(SITE_PARAM, value)
      const qs = params.toString()
      return qs ? `${pathname}?${qs}` : pathname
    },
    [pathname, searchParams]
  )

  // Resolution order, once: URL param, then localStorage, then all sites.
  // Reading localStorage during render would desync SSR and hydration, so the
  // sticky value lands in state here and the URL is corrected to match.
  const initialised = useRef(false)
  useEffect(() => {
    if (initialised.current || status === 'loading') return
    initialised.current = true

    setRecents(readRecents())

    const stored = urlSite ? null : readKey(STORAGE_KEY)
    if (stored && stored !== ALL_SITES) {
      setSticky(stored)
      router.replace(buildUrl(stored), { scroll: false })
    }
    setStickyResolved(true)
  }, [status, urlSite, router, buildUrl])

  // Once the URL carries a value it owns the selection outright, so the sticky
  // fallback stands down. Without this, going back to a bare `/` would keep
  // showing the stored site instead of all sites.
  useEffect(() => {
    if (urlSite && sticky) setSticky(null)
  }, [urlSite, sticky])

  const loadSites = useCallback(async () => {
    try {
      const res = await apiRequest('/api/sites')
      if (!res.ok) return
      setSites(normaliseSites(await res.json()))
      setSitesOk(true)
    } catch {
      /* leave the list empty; the control simply does not render */
    } finally {
      // Settled either way. Blocking on this would strand the whole dashboard
      // on a skeleton whenever the sites list is the only thing that failed.
      setSitesSettled(true)
    }
  }, [])

  // Refetched on focus so a site created in another tab appears without a reload.
  useEffect(() => {
    loadSites()
    const onFocus = () => loadSites()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadSites])

  // A deleted site, a demoted role or a stale bookmark. The server is safe
  // either way, but a dashboard naming a site the user cannot see is worse than
  // one that corrects itself out loud. `replace`, so back does not return here.
  const reportedStale = useRef<string | null>(null)
  useEffect(() => {
    // `sitesOk`, not `sites.length` - a failed request must not be read as
    // proof that the selected site is gone.
    if (!stickyResolved || !sitesOk) return
    if (selected === ALL_SITES || sites.some((s) => s.id === selected)) return
    if (reportedStale.current === selected) return

    reportedStale.current = selected
    writeKey(STORAGE_KEY, null)
    setSticky(null)
    router.replace(buildUrl(ALL_SITES), { scroll: false })
    showToast('That site is no longer available.', 'warning')
  }, [stickyResolved, sitesOk, sites, selected, router, buildUrl, showToast])

  const setSelected = useCallback(
    (value: string) => {
      setSticky(null)
      // The legacy site is never remembered - it must not become the view a
      // user lands on tomorrow without asking for it.
      writeKey(STORAGE_KEY, value === LEGACY_SITE_ID ? null : value)

      if (value !== ALL_SITES && value !== LEGACY_SITE_ID) {
        setRecents((prev) => {
          const next = [value, ...prev.filter((id) => id !== value)].slice(0, RECENTS_LIMIT)
          writeKey(RECENTS_KEY, JSON.stringify(next))
          return next
        })
      }

      // push, not replace: changing site changes what the whole page is about,
      // and back-to-the-previous-site is what people reach for.
      router.push(buildUrl(value), { scroll: false })
    },
    [router, buildUrl]
  )

  const selectedSite = useMemo(
    () => (selected === ALL_SITES ? null : sites.find((s) => s.id === selected) ?? null),
    [selected, sites]
  )

  const ready =
    status !== 'loading' && stickyResolved && (selected === ALL_SITES || sitesSettled)

  return { sites, selected, selectedSite, setSelected, canPick, recents, ready }
}
