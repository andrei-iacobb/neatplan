import { describe, it, expect } from 'vitest'
import {
  EMPTY_CELL,
  exportFilename,
  formatDate,
  formatDateTime,
  formatDueLabel,
  formatExportValue,
  formatIsoDate,
  humanizeEnum,
} from '@/lib/export/format'

describe('formatExportValue', () => {
  it('renders absent values as an empty cell, never as a word', () => {
    expect(formatExportValue(null)).toBe(EMPTY_CELL)
    expect(formatExportValue(undefined)).toBe(EMPTY_CELL)
    expect(formatExportValue('')).toBe(EMPTY_CELL)
    expect(formatExportValue('   ')).toBe(EMPTY_CELL)
  })

  it('scrubs backend sentinels so they never reach a printed sheet', () => {
    expect(formatExportValue('UNKNOWN')).toBe(EMPTY_CELL)
    expect(formatExportValue('N/A')).toBe(EMPTY_CELL)
    expect(formatExportValue('not found')).toBe(EMPTY_CELL)
    expect(formatExportValue('-')).toBe(EMPTY_CELL)
  })

  it('keeps a real value that merely contains a sentinel word', () => {
    expect(formatExportValue('Unknown Corridor')).toBe('Unknown Corridor')
  })

  it('renders booleans as words an operator can read', () => {
    expect(formatExportValue(true)).toBe('Yes')
    expect(formatExportValue(false)).toBe('No')
  })

  it('drops non-finite numbers rather than printing NaN', () => {
    expect(formatExportValue(Number.NaN)).toBe(EMPTY_CELL)
    expect(formatExportValue(Number.POSITIVE_INFINITY)).toBe(EMPTY_CELL)
    expect(formatExportValue(0)).toBe('0')
  })

  it('formats a Date the same way the printed table does', () => {
    const date = new Date('2026-09-13T14:05:00Z')
    expect(formatExportValue(date)).toBe(formatDateTime(date))
  })
})

describe('date formatting', () => {
  it('uses an unambiguous day-month-year form', () => {
    expect(formatDate(new Date(2026, 8, 13))).toBe('13 Sep 2026')
  })

  it('gives an empty cell for an unparseable date', () => {
    expect(formatDate('not a date')).toBe(EMPTY_CELL)
    expect(formatIsoDate(null)).toBe(EMPTY_CELL)
  })

  it('produces a sortable ISO date for filenames and spreadsheet columns', () => {
    expect(formatIsoDate(new Date('2026-09-13T22:30:00Z'))).toBe('2026-09-13')
  })
})

describe('formatDueLabel', () => {
  const now = new Date('2026-09-13T09:00:00')

  it('names today and tomorrow rather than counting to them', () => {
    expect(formatDueLabel(new Date('2026-09-13T23:00:00'), now)).toBe('Today')
    expect(formatDueLabel(new Date('2026-09-14T06:00:00'), now)).toBe('Tomorrow')
  })

  it('counts forward in whole days', () => {
    expect(formatDueLabel(new Date('2026-09-20T09:00:00'), now)).toBe('In 7 days')
  })

  it('phrases overdue work as days late, not a negative number', () => {
    expect(formatDueLabel(new Date('2026-09-12T09:00:00'), now)).toBe('1 day overdue')
    expect(formatDueLabel(new Date('2026-09-06T09:00:00'), now)).toBe('7 days overdue')
  })

  it('compares whole days, so a late evening due time is still "today"', () => {
    // The bug this guards: a 23:59 due time compared against 09:00 "now" is
    // under 24 hours away and would otherwise round to "In 0 days".
    expect(formatDueLabel(new Date('2026-09-13T23:59:00'), now)).toBe('Today')
  })
})

describe('humanizeEnum', () => {
  it('turns a screaming-snake enum into something printable', () => {
    expect(humanizeEnum('SERVICE_AREA')).toBe('Service area')
    expect(humanizeEnum('HEAD_OF_HOUSEKEEPING')).toBe('Head of housekeeping')
    expect(humanizeEnum('DAILY')).toBe('Daily')
  })

  it('gives an empty cell for an absent value', () => {
    expect(humanizeEnum(null)).toBe(EMPTY_CELL)
    expect(humanizeEnum(undefined)).toBe(EMPTY_CELL)
  })
})

describe('exportFilename', () => {
  it('keeps exports sortable in a download folder', () => {
    expect(exportFilename('completions', 'csv', new Date('2026-09-13T10:00:00Z'))).toBe(
      'neatplan-completions-2026-09-13.csv'
    )
  })
})
