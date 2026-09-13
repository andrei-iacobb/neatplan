import type { ExportValue } from './types'

/**
 * Backend sentinels that must never reach a printed page or a spreadsheet cell.
 * They are scrubbed to the designed placeholder instead.
 */
const SENTINELS = new Set(['UNKNOWN', 'N/A', 'NA', 'NOT FOUND', 'NULL', 'UNDEFINED', '-'])

/** What an absent value looks like everywhere. */
export const EMPTY_CELL = ''

/*
 * Month names are spelled out here rather than taken from Intl on purpose. A
 * compliance document gets printed and filed, and `Intl.DateTimeFormat('en-GB')`
 * has already changed its September abbreviation between ICU versions ("Sep" ->
 * "Sept"). A Node upgrade must not silently change how last year's archived
 * reports read.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (value: number) => String(value).padStart(2, '0')

/** `13 Sep 2026`. Used for every date shown to a person. */
export function formatDate(value: Date | string | null | undefined): string {
  const date = toDate(value)
  if (!date) return EMPTY_CELL
  return `${pad(date.getDate())} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/** `13 Sep 2026 14:05`, 24-hour so an overnight shift reads unambiguously. */
export function formatDateTime(value: Date | string | null | undefined): string {
  const date = toDate(value)
  if (!date) return EMPTY_CELL
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * `2026-09-13` in UTC. For round-tripping a value that was itself parsed as an
 * instant, where shifting it would change what it means.
 */
export function formatIsoDate(value: Date | string | null | undefined): string {
  const date = toDate(value)
  return date ? date.toISOString().slice(0, 10) : EMPTY_CELL
}

/**
 * `2026-09-13` as the calendar day the USER is living in.
 *
 * toISOString would answer the wrong question here. Local midnight on Monday is
 * still Sunday in UTC anywhere east of Greenwich, so a "what day is it" value
 * serialised through toISOString silently becomes the previous day for the whole
 * of BST - and a week anchor built from it lands a full week early.
 */
export function toLocalIsoDate(value: Date | string | null | undefined): string {
  const date = toDate(value)
  if (!date) return EMPTY_CELL
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * `SERVICE_AREA` -> `Service area`. Enum values are stored screaming-snake and
 * are unreadable on a printed sheet handed to a regulator.
 */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return EMPTY_CELL
  const words = value.replace(/_/g, ' ').toLowerCase().trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Days until `due`, phrased the way an operator reads it. Overdue turns into a
 * count of days late rather than a negative number.
 */
export function formatDueLabel(due: Date | string | null | undefined, now = new Date()): string {
  const date = toDate(due)
  if (!date) return EMPTY_CELL

  const startOfDay = (d: Date) => {
    const copy = new Date(d)
    copy.setHours(0, 0, 0, 0)
    return copy
  }

  const days = Math.round(
    (startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000
  )

  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return '1 day overdue'
  if (days < 0) return `${Math.abs(days)} days overdue`
  return `In ${days} days`
}

/**
 * The single normalisation point for both media. Anything a column returns ends
 * up here, so a Date renders identically in a CSV cell and in a table cell.
 */
export function formatExportValue(value: ExportValue): string {
  if (value === null || value === undefined) return EMPTY_CELL
  if (value instanceof Date) return formatDateTime(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : EMPTY_CELL

  const trimmed = value.trim()
  if (trimmed === '' || SENTINELS.has(trimmed.toUpperCase())) return EMPTY_CELL
  return trimmed
}

/**
 * Filename stem for a download. Keeps the dataset slug and the date so a folder
 * of exports stays sortable.
 */
export function exportFilename(slug: string, extension: string, now = new Date()): string {
  // The user's calendar day, not UTC's - an export taken at 00:30 BST belongs to
  // today in the folder it lands in.
  return `neatplan-${slug}-${toLocalIsoDate(now)}.${extension}`
}
