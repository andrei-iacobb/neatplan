import { describe, it, expect } from 'vitest'
import { datasetToCsv, escapeCsvCell } from '@/lib/export/csv'
import type { ExportDataset } from '@/lib/export/types'

type Row = { name: string; count: number; note: string | null; internal: string }

function dataset(overrides: Partial<ExportDataset<Row>> = {}): ExportDataset<Row> {
  return {
    slug: 'test',
    title: 'Room inventory',
    subtitle: 'Beech House',
    filters: [{ label: 'Site', value: 'Beech House' }],
    columns: [
      { key: 'name', header: 'Room', value: (r) => r.name },
      { key: 'count', header: 'Tasks', value: (r) => r.count, align: 'right' },
      { key: 'note', header: 'Notes', value: (r) => r.note, wrap: true },
      { key: 'internal', header: 'Internal', value: (r) => r.internal, only: 'print' },
    ],
    rows: [{ name: 'Room 1', count: 3, note: null, internal: 'hidden' }],
    ...overrides,
  }
}

function body(csv: string): string[] {
  // Everything after the blank separator line is header + rows.
  const lines = csv.split('\r\n')
  const blank = lines.indexOf('')
  return lines.slice(blank + 1).filter((line) => line !== '')
}

describe('escapeCsvCell', () => {
  it('leaves a plain value untouched', () => {
    expect(escapeCsvCell('Room 1')).toBe('Room 1')
  })

  it('quotes and doubles embedded quotes', () => {
    expect(escapeCsvCell('He said "clean"')).toBe('"He said ""clean"""')
  })

  it('quotes values containing a comma or a newline', () => {
    expect(escapeCsvCell('Ground, First')).toBe('"Ground, First"')
    expect(escapeCsvCell('line one\nline two')).toBe('"line one\nline two"')
  })

  it('neutralises spreadsheet formula triggers', () => {
    // A completion note is free text typed by a cleaner. Without this, a note
    // beginning "=" becomes a live formula the moment the CSV is opened.
    expect(escapeCsvCell('=1+1')).toBe("'=1+1")
    expect(escapeCsvCell('+44 7700 900000')).toBe("'+44 7700 900000")
    expect(escapeCsvCell('@user')).toBe("'@user")
    expect(escapeCsvCell('-5 degrees')).toBe("'-5 degrees")
  })

  it('still quotes a neutralised value that also needs quoting', () => {
    expect(escapeCsvCell('=cmd|"/c calc"!A1')).toBe('"\'=cmd|""/c calc""!A1"')
  })

  it('does not touch a formula character that is not leading', () => {
    expect(escapeCsvCell('Room = clean')).toBe('Room = clean')
  })
})

describe('datasetToCsv', () => {
  it('starts with a UTF-8 BOM so Excel reads accented room names correctly', () => {
    expect(datasetToCsv(dataset())).toMatch(/^﻿/)
  })

  it('uses CRLF line endings', () => {
    const csv = datasetToCsv(dataset())
    expect(csv).toContain('\r\n')
    expect(csv.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('carries the filter context that produced the document', () => {
    const csv = datasetToCsv(dataset())
    expect(csv).toContain('Room inventory')
    expect(csv).toContain('Beech House')
    expect(csv).toContain('Site,Beech House')
    expect(csv).toContain('Exported,')
  })

  it('omits print-only columns', () => {
    const [header, row] = body(datasetToCsv(dataset()))
    expect(header).toBe('Room,Tasks,Notes')
    expect(row).toBe('Room 1,3,')
    expect(header).not.toContain('Internal')
    expect(row).not.toContain('hidden')
  })

  it('renders a null cell as empty rather than the string "null"', () => {
    const [, row] = body(datasetToCsv(dataset()))
    expect(row.endsWith(',')).toBe(true)
    expect(row).not.toContain('null')
  })

  it('states truncation out loud instead of dropping rows silently', () => {
    const csv = datasetToCsv(dataset({ truncated: { cap: 5000, total: 12345 } }))
    expect(csv).toContain('Truncated')
    expect(csv).toContain('Showing the first 5000 of 12345 matching rows')
  })

  it('says nothing about truncation when the full result fitted', () => {
    expect(datasetToCsv(dataset())).not.toContain('Truncated')
  })

  it('emits a header row even when nothing matched', () => {
    const lines = body(datasetToCsv(dataset({ rows: [] })))
    expect(lines).toEqual(['Room,Tasks,Notes'])
  })
})
