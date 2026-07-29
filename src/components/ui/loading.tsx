'use client'

/**
 * The app's only loading treatments.
 *
 * There are exactly two, split by size rather than by page:
 *  - Skeleton / PageLoading for anything that occupies a region. It holds the
 *    layout so nothing jumps when the data lands, and it says what is coming.
 *  - Spinner for inline states inside a button or a row, where a skeleton has
 *    nowhere to sit.
 *
 * Nothing else should hand-roll a rotating ring. Both treatments animate in
 * CSS, so the `prefers-reduced-motion` block in globals.css already stops them.
 */

const SURFACE = 'rgb(var(--surface-raised))'
const BORDER = 'rgb(var(--border) / var(--border-alpha))'

interface SkeletonProps {
  className?: string
  /** Inline width override, for text lines of uneven length. */
  width?: string | number
}

/** A single pulsing placeholder block. Size it with Tailwind classes. */
export function Skeleton({ className = '', width }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md ${className}`}
      style={{ background: SURFACE, width }}
    />
  )
}

interface PageLoadingProps {
  /** Number of placeholder cards below the header. */
  cards?: number
  /**
   * Widest column count, so the skeleton matches the layout it stands in for.
   * Use 3 for card grids, 4 for stat tile rows, 1 for stacked full-width panels.
   */
  columns?: 1 | 2 | 3 | 4
  /** Hide the title/subtitle block when the page header renders separately. */
  header?: boolean
  className?: string
  /** Announced to screen readers while the region is loading. */
  label?: string
}

const COLUMN_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: '',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
}

/**
 * Full-page and full-section loading state. Shape-matched to the dashboard
 * layout: a title block, then a grid of cards.
 */
export function PageLoading({
  cards = 6,
  columns = 3,
  header = true,
  className = '',
  label = 'Loading',
}: PageLoadingProps) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {header && (
        <div className="mb-8 space-y-3">
          <Skeleton className="h-7" width={220} />
          <Skeleton className="h-4" width={340} />
        </div>
      )}
      <div className={`grid gap-4 ${COLUMN_CLASS[columns]}`}>
        {Array.from({ length: cards }, (_, i) => (
          <div
            key={i}
            className="rounded-xl p-4 space-y-3"
            style={{ border: `1px solid ${BORDER}` }}
          >
            <Skeleton className="h-4" width="60%" />
            <Skeleton className="h-3" width="85%" />
            <Skeleton className="h-3" width="40%" />
          </div>
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  )
}

/** Vertical list loading state, for tables and log feeds. */
export function ListLoading({
  rows = 6,
  className = '',
  label = 'Loading',
}: {
  rows?: number
  className?: string
  label?: string
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={`space-y-2 ${className}`}
    >
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="rounded-lg px-4 py-3 flex items-center gap-4"
          style={{ border: `1px solid ${BORDER}` }}
        >
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4" width={90} />
          <Skeleton className="h-4" width={60} />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}

const SPINNER_SIZE = { sm: 14, md: 16, lg: 20 } as const

interface SpinnerProps {
  size?: keyof typeof SPINNER_SIZE
  /** Ring colour. Defaults to the current text colour, so it matches its button. */
  color?: string
  className?: string
}

/**
 * Inline busy indicator. Only for buttons and single rows, never for a whole
 * page - use PageLoading or ListLoading there.
 */
export function Spinner({ size = 'sm', color, className = '' }: SpinnerProps) {
  const px = SPINNER_SIZE[size]
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block shrink-0 animate-spin rounded-full ${className}`}
      style={{
        width: px,
        height: px,
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        color: color ?? 'currentColor',
        opacity: 0.9,
      }}
    />
  )
}
