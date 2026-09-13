'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, DoorOpen, Search, Wrench } from 'lucide-react'
import { normalizeShortCodeClient } from '@/lib/short-code-client'

export interface FindableLocation {
  kind: 'room' | 'equipment'
  id: string
  name: string
  place: string
  code: string
  href: string
}

/**
 * Search by name, floor or printed code.
 *
 * Tablet-first: a single large field, results as full-width rows with a 56px
 * target, and no dropdown or combobox to fight with a touch keyboard.
 */
export function LocationFinder({ locations }: { locations: FindableLocation[] }) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const raw = query.trim()
    if (!raw) return locations.slice(0, 40)

    const needle = raw.toLowerCase()
    // Somebody typing off a label may miss the hyphen or hit I for 1, so the
    // code path gets the same normalisation the server applies.
    const asCode = normalizeShortCodeClient(raw)

    return locations
      .filter(
        (location) =>
          (asCode && location.code === asCode) ||
          location.name.toLowerCase().includes(needle) ||
          location.place.toLowerCase().includes(needle) ||
          location.code.toLowerCase().includes(needle)
      )
      .slice(0, 40)
  }, [locations, query])

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <Link
        href="/clean"
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 rounded-lg px-1"
        style={{ color: 'rgb(var(--text-muted))' }}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to my work
      </Link>

      <h1 className="text-[24px] font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
        Find a location
      </h1>
      <p className="mt-1 text-[14px]" style={{ color: 'rgb(var(--text-muted))' }}>
        Search by name or floor, or type the code printed under the QR on the label.
      </p>

      <div className="relative mt-5">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
          style={{ color: 'rgb(var(--text-muted))' }}
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Room 12, Ground Floor, or A4B2-9KDX"
          aria-label="Search by name, floor or label code"
          autoComplete="off"
          autoCapitalize="characters"
          // 16px minimum stops iOS zooming the whole page on focus.
          className="min-h-14 w-full rounded-xl pl-12 pr-4 text-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          style={{
            background: 'rgb(var(--surface-raised))',
            border: '1px solid rgb(var(--control-border) / 0.6)',
            color: 'rgb(var(--text-primary))',
          }}
        />
      </div>

      {results.length === 0 ? (
        <p className="mt-8 text-center text-[14px]" style={{ color: 'rgb(var(--text-muted))' }}>
          Nothing at your site matches that. Check the code, or search for the room by name.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {results.map((location) => (
            <li key={`${location.kind}-${location.id}`}>
              <Link
                href={location.href}
                className="flex min-h-14 items-center gap-3 rounded-xl px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 active:scale-[0.99] motion-reduce:active:scale-100"
                style={{
                  background: 'rgb(var(--card))',
                  border: '1px solid rgb(var(--border) / var(--border-alpha))',
                }}
              >
                {location.kind === 'room' ? (
                  <DoorOpen className="h-5 w-5 shrink-0" style={{ color: 'rgb(var(--primary))' }} aria-hidden="true" />
                ) : (
                  <Wrench className="h-5 w-5 shrink-0" style={{ color: 'rgb(var(--accent))' }} aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                    {location.name}
                  </span>
                  {location.place ? (
                    <span className="block truncate text-[12px]" style={{ color: 'rgb(var(--text-muted))' }}>
                      {location.place}
                    </span>
                  ) : null}
                </span>
                <span
                  className="shrink-0 font-mono text-[12px] tracking-wider"
                  style={{ color: 'rgb(var(--text-muted))' }}
                >
                  {location.code}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
