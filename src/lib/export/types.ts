import type { SessionUser } from '@/lib/authz'

/**
 * The value types a column may yield. Everything is normalised through
 * `formatExportValue` so CSV and the printed page can never disagree about how a
 * date or a null renders.
 */
export type ExportValue = string | number | boolean | Date | null | undefined

export interface ExportColumn<T> {
  /** Stable key. Used for React keys and for column-level tests. */
  key: string
  header: string
  value: (row: T) => ExportValue
  /**
   * Print column width as a flex ratio. CSV ignores it. Columns without one get
   * a ratio of 1.
   */
  width?: number
  align?: 'left' | 'right'
  /**
   * Free text that may run to several lines. Printed cells wrap instead of
   * being truncated, because a clipped note is worse than a tall row on paper.
   */
  wrap?: boolean
  /**
   * Restrict the column to one medium. Used where a value is useful in a
   * spreadsheet but pure noise on paper (raw ids), or vice versa.
   */
  only?: 'csv' | 'print'
}

/** One piece of "what produced this document" context, shown in the header. */
export interface ExportFilterChip {
  label: string
  value: string
}

/** A headline number printed above the table. */
export interface ExportSummaryStat {
  label: string
  value: string
}

/**
 * Set when the row cap clipped the result. The document always says so out
 * loud: a silently short export is a compliance problem, not a UI detail.
 */
export interface ExportTruncation {
  cap: number
  total: number
}

export interface ExportDataset<T = unknown> {
  slug: string
  title: string
  /** Usually the site, or "All sites". */
  subtitle?: string
  filters: ExportFilterChip[]
  summary?: ExportSummaryStat[]
  columns: ExportColumn<T>[]
  rows: T[]
  truncated?: ExportTruncation
  /** Rendered at the foot of the printed document, above the page number. */
  note?: string
}

export interface DatasetRequest {
  user: SessionUser
  params: URLSearchParams
}

export interface DatasetLoadResult<T> {
  rows: T[]
  /** Total matching rows before the cap, so truncation can be reported exactly. */
  total: number
  filters: ExportFilterChip[]
  subtitle?: string
  summary?: ExportSummaryStat[]
  note?: string
}

export interface DatasetDefinition<T> {
  title: string
  /** Filename stem. `rooms` -> `neatplan-rooms-2026-09-13.csv`. */
  slug: string
  /** Extra gate beyond rank, e.g. the cleaning portal capability. */
  authorize?: (user: SessionUser) => boolean
  /**
   * Row cap. Reaching it is reported in the document rather than silently
   * dropping rows.
   */
  cap: number
  columns: ExportColumn<T>[]
  load: (req: DatasetRequest, cap: number) => Promise<DatasetLoadResult<T>>
}
