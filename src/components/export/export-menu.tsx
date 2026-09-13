'use client'

import { useSession } from 'next-auth/react'
import { Download, Printer } from 'lucide-react'
import { roleCanExport, type DatasetId } from '@/lib/export/permissions'

interface ExportMenuProps {
  dataset: DatasetId
  /**
   * The filters currently applied on screen. Whatever is here is applied to
   * every matching row on the server, not just the page being viewed, so the
   * export and the screen always describe the same set.
   *
   * Empty and 'all'-style values are dropped so an unfiltered export does not
   * carry meaningless query noise into the document header.
   */
  filters?: Record<string, string | null | undefined>
  /** Compact form for placement inside a dense filter bar. */
  size?: 'default' | 'sm'
  className?: string
}

const IGNORED_FILTER_VALUES = new Set(['', 'all', 'ALL'])

export function buildExportQuery(filters: ExportMenuProps['filters']): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value === null || value === undefined) continue
    const trimmed = String(value).trim()
    if (IGNORED_FILTER_VALUES.has(trimmed)) continue
    params.set(key, trimmed)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

/**
 * The one export entrypoint, used on every surface that has exportable data.
 *
 * Two actions, deliberately: CSV for a spreadsheet, and a themed document for
 * reading, printing or saving as PDF. Both are plain links, so they middle-click,
 * long-press and open in a new tab the way an operator expects.
 *
 * Renders nothing when the signed-in role may not export this dataset. The
 * server re-checks before running any query; this only decides whether to draw
 * the control.
 */
export function ExportMenu({ dataset, filters, size = 'default', className }: ExportMenuProps) {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role

  if (!roleCanExport(dataset, role)) return null

  const query = buildExportQuery(filters)
  // 44px is the iPadOS touch floor and this app is used on a tablet in one hand.
  const base =
    'inline-flex items-center gap-2 rounded-lg border border-[rgb(var(--control-border))] bg-[rgb(var(--surface))] font-medium text-[rgb(var(--text-secondary))] transition-colors hover:bg-[rgb(var(--surface-raised))] hover:text-[rgb(var(--text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary))] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--card))] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100'
  const sizing = size === 'sm' ? 'h-10 px-3 text-xs' : 'min-h-[44px] px-4 text-sm'

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`} data-print-hide>
      <a
        className={`${base} ${sizing}`}
        href={`/api/export/${dataset}${query}`}
        download
        title="Download every matching row as a spreadsheet"
      >
        <Download size={16} aria-hidden="true" />
        CSV
      </a>
      <a
        className={`${base} ${sizing}`}
        href={`/print/${dataset}${query}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Open a printable document of every matching row"
      >
        <Printer size={16} aria-hidden="true" />
        Print
      </a>
    </div>
  )
}
