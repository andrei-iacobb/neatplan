'use client'

/**
 * The dashboard's site scope control.
 *
 * Presentation only - the selection lives in `useSiteFilter`, so this can move
 * into a global topbar later without touching its behaviour.
 *
 * The control changes shape with the number of sites, because a fixed pill row
 * fails earlier than instinct suggests: the header's right slot is roughly
 * 500px and a real site name in a pill is roughly 130px, so three names fit.
 *
 *   0        nothing renders
 *   1        static chip - a choice of one is not a choice, but the name still
 *            has to be on screen so "109 rooms" is not ambiguous
 *   2 - 4    pill row, whole option set visible, zero clicks to switch
 *   5 - 10   popover, scanning still beats typing
 *   11 - 25  popover with an autofocused search box
 *   26+      the above plus a pinned group of the last three selections
 *
 * A MANAGER always gets the chip regardless of count: their view is pinned by
 * the server and always was, but nothing in the chrome used to say so.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Building2, Check, ChevronDown, Layers, Search } from 'lucide-react'
import { fade, transitionFast } from '@/lib/motion'
import { useThemeColors } from '@/hooks/useThemeColors'
import { ALL_SITES, LEGACY_SITE_HINT, type SiteOption } from '@/hooks/useSiteFilter'

/**
 * Count thresholds. The plan set the pill ceiling at 4 because the control lived in the
 * header's ~500px right slot; it now has the full 1230px column, so eight names fit
 * before a popover earns its place. Above that the row would wrap into a wall.
 */
const MAX_PILLS = 8
const MIN_FOR_SEARCH = 11
const MIN_FOR_RECENTS = 26

const ALL_SITES_LABEL = 'All sites'

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-0'

export interface SiteFilterProps {
  sites: SiteOption[]
  selected: string
  onSelect: (value: string) => void
  /** False for MANAGER and CLEANER - they get the chip, never the picker. */
  canPick: boolean
  recents?: string[]
  className?: string
}

export function SiteFilter({
  sites,
  selected,
  onSelect,
  canPick,
  recents = [],
  className = '',
}: SiteFilterProps) {
  const tc = useThemeColors()

  const label = useMemo(() => {
    if (selected === ALL_SITES) return ALL_SITES_LABEL
    return sites.find((s) => s.id === selected)?.name ?? ALL_SITES_LABEL
  }, [selected, sites])

  // Nothing to scope by. Fresh database, or a pinned user with no site.
  if (sites.length === 0) return null

  if (!canPick || sites.length === 1) {
    const name = sites[0].name
    return (
      <div className={className}>
        <span
          className="inline-flex items-center gap-2 rounded-lg px-3 min-h-[40px] text-[13px] font-medium"
          style={{
            background: tc.tabInactiveBg,
            color: tc.textMuted,
            border: `1px solid ${tc.inputBorder}`,
          }}
        >
          <Building2 className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
          <span className="truncate max-w-[220px]">{name}</span>
        </span>
        <span className="sr-only">Dashboard is showing {name}.</span>
      </div>
    )
  }

  return (
    <div className={className}>
      {sites.length <= MAX_PILLS ? (
        <PillRow sites={sites} selected={selected} onSelect={onSelect} />
      ) : (
        <SitePopover
          sites={sites}
          selected={selected}
          onSelect={onSelect}
          label={label}
          withSearch={sites.length >= MIN_FOR_SEARCH}
          recents={sites.length >= MIN_FOR_RECENTS ? recents : []}
        />
      )}
      {/* The scope is the one thing a screen reader must hear change. */}
      <span aria-live="polite" className="sr-only">
        Dashboard is showing {label}.
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 2 - 4 sites: pill row                                                       */
/* -------------------------------------------------------------------------- */

function PillRow({
  sites,
  selected,
  onSelect,
}: {
  sites: SiteOption[]
  selected: string
  onSelect: (value: string) => void
}) {
  return (
    <div
      role="group"
      aria-label="Filter dashboard by site"
      className="flex flex-wrap items-center gap-1.5"
    >
      <Pill
        active={selected === ALL_SITES}
        onClick={() => onSelect(ALL_SITES)}
        icon={<Layers className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />}
      >
        {ALL_SITES_LABEL}
      </Pill>
      {sites.map((site) => (
        <Pill
          key={site.id}
          active={selected === site.id}
          onClick={() => onSelect(site.id)}
          muted={site.isLegacy}
          title={site.isLegacy ? LEGACY_SITE_HINT : undefined}
        >
          {site.name}
        </Pill>
      ))}
    </div>
  )
}

function Pill({
  active,
  muted = false,
  onClick,
  children,
  icon,
  title,
}: {
  active: boolean
  muted?: boolean
  onClick: () => void
  children: React.ReactNode
  icon?: React.ReactNode
  title?: string
}) {
  const tc = useThemeColors()
  const idle = {
    background: tc.tabInactiveBg,
    color: muted ? tc.textFaint : tc.tabInactiveText,
    border: '1px solid transparent',
  }
  const on = {
    background: tc.tabActiveBg,
    color: tc.tabActiveText,
    border: `1px solid ${tc.tabActiveBorder}`,
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`flex items-center gap-1.5 px-3 min-h-[40px] rounded-lg text-[13px] font-medium max-w-[190px] transition-all duration-200 active:scale-[0.97] ${FOCUS_RING}`}
      style={active ? on : idle}
      onMouseEnter={(e) => {
        if (active) return
        e.currentTarget.style.background = tc.tabInactiveHoverBg
        e.currentTarget.style.color = tc.tabInactiveHoverText
      }}
      onMouseLeave={(e) => {
        if (active) return
        e.currentTarget.style.background = idle.background
        e.currentTarget.style.color = idle.color
      }}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* 5+ sites: popover                                                           */
/* -------------------------------------------------------------------------- */

interface Row {
  key: string
  id: string
  name: string
  muted: boolean
  title?: string
  /** Group heading rendered above this row, if it opens a group. */
  heading?: string
}

function SitePopover({
  sites,
  selected,
  onSelect,
  label,
  withSearch,
  recents,
}: {
  sites: SiteOption[]
  selected: string
  onSelect: (value: string) => void
  label: string
  withSearch: boolean
  recents: string[]
}) {
  const tc = useThemeColors()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<(HTMLDivElement | null)[]>([])
  const listId = useId()

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase()
    const matches = (s: SiteOption) =>
      !q || s.name.toLowerCase().includes(q) || (s.address ?? '').toLowerCase().includes(q)

    const out: Row[] = []
    if (!q) {
      out.push({ key: 'all', id: ALL_SITES, name: ALL_SITES_LABEL, muted: false })
    }

    // Recents are a shortcut, not a filter: they repeat entries from the full
    // list below rather than removing them, so the list never reorders itself
    // under someone who has learned where a site sits.
    const recentSites = recents
      .map((id) => sites.find((s) => s.id === id))
      .filter((s): s is SiteOption => Boolean(s) && matches(s as SiteOption))

    recentSites.forEach((s, i) => {
      out.push({
        key: `recent-${s.id}`,
        id: s.id,
        name: s.name,
        muted: false,
        heading: i === 0 ? 'Recent' : undefined,
      })
    })

    sites.filter(matches).forEach((s, i) => {
      out.push({
        key: s.id,
        id: s.id,
        name: s.name,
        muted: s.isLegacy,
        title: s.isLegacy ? LEGACY_SITE_HINT : undefined,
        heading: i === 0 && recentSites.length > 0 ? 'All sites' : undefined,
      })
    })

    return out
  }, [sites, recents, query])

  const close = useCallback(
    (refocus = true) => {
      setOpen(false)
      setQuery('')
      if (refocus) triggerRef.current?.focus()
    },
    []
  )

  // Open on the current selection so the first arrow press moves from where
  // the user already is.
  const openWith = useCallback(() => {
    const at = rows.findIndex((r) => r.id === selected)
    setActiveIndex(at >= 0 ? at : 0)
    setOpen(true)
  }, [rows, selected])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, close])

  useEffect(() => {
    if (!open) return
    if (withSearch) searchRef.current?.focus()
    else listRef.current?.focus()
  }, [open, withSearch])

  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  // Filtering can shorten the list under the cursor.
  useEffect(() => {
    setActiveIndex((i) => (i > rows.length - 1 ? Math.max(0, rows.length - 1) : i))
  }, [rows.length])

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => (rows.length ? (i + 1) % rows.length : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0))
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(Math.max(0, rows.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (rows[activeIndex]) {
          onSelect(rows[activeIndex].id)
          close()
        }
        break
      case 'Escape':
        e.preventDefault()
        close()
        break
      case 'Tab':
        // Tab leaves the control rather than cycling inside it; a listbox is
        // not a dialog, so it does not trap focus.
        close(false)
        break
    }
  }

  const activeId = rows[activeIndex] ? `${listId}-${rows[activeIndex].key}` : undefined

  return (
    <div ref={wrapRef} className="relative w-full sm:w-auto">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Filter dashboard by site. Currently showing ${label}`}
        onClick={() => (open ? close(false) : openWith())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault()
            openWith()
          }
        }}
        className={`flex w-full sm:w-auto sm:min-w-[190px] items-center gap-2 px-3 min-h-[40px] rounded-lg text-[13px] font-medium transition-colors duration-200 active:scale-[0.97] ${FOCUS_RING}`}
        style={{
          background: open ? tc.tabActiveBg : tc.tabInactiveBg,
          color: open ? tc.tabActiveText : tc.tabInactiveText,
          border: `1px solid ${open ? tc.tabActiveBorder : tc.inputBorder}`,
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.background = tc.tabInactiveHoverBg
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = tc.tabInactiveBg
        }}
      >
        <Building2 className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
        <span className="truncate flex-1 text-left">{label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            {...fade}
            exit={{ opacity: 0 }}
            transition={transitionFast}
            className="absolute z-50 mt-1.5 right-0 w-full sm:w-[260px] rounded-lg overflow-hidden"
            style={{
              background: tc.modalBg,
              border: `1px solid ${tc.inputBorder}`,
              // Cards use tc.shadow, which is `none` in dark - too flat for a
              // layer that floats over other content, so this one lifts by a
              // deeper shadow in dark and a softer one in light.
              boxShadow: tc.d ? '0 10px 30px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
            }}
          >
            {withSearch && (
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{ borderBottom: `1px solid ${tc.divider}` }}
              >
                <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tc.textFaint }} aria-hidden="true" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActiveIndex(0)
                  }}
                  onKeyDown={onKeyDown}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-activedescendant={activeId}
                  aria-autocomplete="list"
                  aria-label="Search sites"
                  placeholder="Search sites"
                  className="w-full bg-transparent outline-none text-[13px]"
                  style={{ color: tc.inputText }}
                />
              </div>
            )}

            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label="Sites"
              aria-activedescendant={withSearch ? undefined : activeId}
              tabIndex={withSearch ? -1 : 0}
              onKeyDown={withSearch ? undefined : onKeyDown}
              className={`max-h-[280px] overflow-y-auto py-1 ${FOCUS_RING}`}
            >
              {rows.length === 0 && (
                <p className="px-3 py-3 text-[13px]" style={{ color: tc.textFaint }}>
                  No sites match &ldquo;{query}&rdquo;
                </p>
              )}
              {rows.map((row, i) => (
                <div key={row.key}>
                  {row.heading && (
                    <p
                      className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide"
                      style={{ color: tc.textFaint }}
                    >
                      {row.heading}
                    </p>
                  )}
                  <div
                    ref={(el) => {
                      optionRefs.current[i] = el
                    }}
                    id={`${listId}-${row.key}`}
                    role="option"
                    aria-selected={row.id === selected}
                    title={row.title}
                    onClick={() => {
                      onSelect(row.id)
                      close()
                    }}
                    onMouseMove={() => setActiveIndex(i)}
                    className="flex items-center gap-2 px-3 min-h-[40px] mx-1 rounded-md cursor-pointer text-[13px] font-medium"
                    style={{
                      background: i === activeIndex ? tc.tabInactiveHoverBg : 'transparent',
                      color:
                        row.id === selected
                          ? tc.tabActiveText
                          : row.muted
                            ? tc.textFaint
                            : tc.textSecondary,
                    }}
                  >
                    <span className="truncate flex-1">{row.name}</span>
                    {row.id === selected && (
                      <Check className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
