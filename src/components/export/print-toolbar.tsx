'use client'

import { Printer, Download, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface PrintToolbarProps {
  /** Where the CSV of the same filtered rows can be downloaded. */
  csvHref: string
  title: string
  rowCount: number
  /** True when the dataset cap clipped the result, so the toolbar can say so. */
  truncated: boolean
  /** Label sheets have no spreadsheet form; a CSV of QR images is meaningless. */
  hideCsv?: boolean
}

/**
 * Screen-only controls above the document. Hidden in print by `.pd-toolbar`, so
 * a printed sheet never carries its own buttons.
 */
function unit(count: number, isLabelSheet?: boolean): string {
  if (isLabelSheet) return count === 1 ? 'label' : 'labels'
  return count === 1 ? 'row' : 'rows'
}

export function PrintToolbar({ csvHref, title, rowCount, truncated, hideCsv }: PrintToolbarProps) {
  const router = useRouter()

  return (
    <div className="pd-toolbar" data-print-hide>
      <button type="button" className="pd-btn" onClick={() => router.back()}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back
      </button>

      <div className="pd-toolbar__spacer">
        <span className="sr-only">{title}, </span>
        <span style={{ fontSize: 13, color: '#6e6e85' }}>
          {rowCount.toLocaleString()} {unit(rowCount, hideCsv)}
          {truncated ? ' (capped - see notice below)' : ''}
        </span>
      </div>

      {hideCsv ? null : (
        <a className="pd-btn" href={csvHref} download>
          <Download size={16} aria-hidden="true" />
          CSV
        </a>
      )}

      <button type="button" className="pd-btn pd-btn--primary" onClick={() => window.print()}>
        <Printer size={16} aria-hidden="true" />
        Print
      </button>
    </div>
  )
}
