import { formatExportValue } from './format'
import type { ExportColumn, ExportDataset } from './types'

/**
 * Excel on Windows will not detect UTF-8 in a CSV without a byte-order mark, so
 * a room called "Café" arrives as "CafÃ©". The BOM costs three bytes and fixes it
 * everywhere; Numbers, LibreOffice and pandas all skip it.
 */
const BOM = '﻿'

/** RFC 4180 says CRLF, and Excel is the strictest consumer we have. */
const EOL = '\r\n'

/**
 * Leading characters that make a spreadsheet treat a cell as a formula. Room
 * names and completion notes are free text typed by users, so a note beginning
 * `=cmd|...` would otherwise become an executable cell on open. Prefixing with an
 * apostrophe keeps the text visible and inert.
 *
 * The apostrophe is added BEFORE quoting so it survives the escape below.
 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r']

export function escapeCsvCell(raw: string): string {
  let value = raw

  if (value.length > 0 && FORMULA_TRIGGERS.includes(value[0])) {
    value = `'${value}`
  }

  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function csvColumns<T>(columns: ExportColumn<T>[]): ExportColumn<T>[] {
  return columns.filter((column) => column.only !== 'print')
}

/**
 * Serialise a dataset to CSV.
 *
 * The filter context that produced the document is written as comment-style
 * leading lines rather than being dropped, so a spreadsheet on someone's desktop
 * still says which site and which date range it came from. Truncation, when it
 * happened, is stated in the same block.
 */
export function datasetToCsv<T>(dataset: ExportDataset<T>): string {
  const columns = csvColumns(dataset.columns)
  const lines: string[] = []

  lines.push(escapeCsvCell(dataset.title))
  if (dataset.subtitle) lines.push(escapeCsvCell(dataset.subtitle))
  for (const filter of dataset.filters) {
    lines.push(`${escapeCsvCell(filter.label)},${escapeCsvCell(filter.value)}`)
  }
  lines.push(`${escapeCsvCell('Exported')},${escapeCsvCell(new Date().toISOString())}`)

  if (dataset.truncated) {
    lines.push(
      `${escapeCsvCell('Truncated')},${escapeCsvCell(
        `Showing the first ${dataset.truncated.cap} of ${dataset.truncated.total} matching rows. Narrow the filters to export the rest.`
      )}`
    )
  }

  lines.push('')
  lines.push(columns.map((column) => escapeCsvCell(column.header)).join(','))

  for (const row of dataset.rows) {
    lines.push(
      columns
        .map((column) => escapeCsvCell(formatExportValue(column.value(row))))
        .join(',')
    )
  }

  return BOM + lines.join(EOL) + EOL
}
