'use client'

import { useState } from 'react'
import { toLocalIsoDate } from '@/lib/export/format'
import { ExportMenu } from './export-menu'

interface WorklistActionsProps {
  /** Site to scope the list to. Ignored by the server for site-pinned roles. */
  site?: string | null
  /** Person the sheet is for. Only honoured for roles above CLEANER. */
  userId?: string | null
  allocation?: 'person' | 'all' | 'unassigned'
  className?: string
}

const SCOPES = [
  { id: 'day', label: 'Today' },
  { id: 'week', label: 'This week' },
] as const

type Scope = (typeof SCOPES)[number]['id']

/**
 * Worklist export with a day/week choice.
 *
 * Deliberately small: the tablet dashboard below is the place work actually gets
 * done, and this is the escape hatch for a handover sheet or a manager's round.
 * Printing is never on the critical path.
 */
export function WorklistActions({ site, userId, allocation = 'all', className }: WorklistActionsProps) {
  const [scope, setScope] = useState<Scope>('day')
  // Local, not UTC: between local midnight and UTC midnight in BST, toISOString
  // would hand a cleaner yesterday's round.
  const today = toLocalIsoDate(new Date())

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className ?? ''}`} data-print-hide>
      <div
        className="flex rounded-xl p-1"
        style={{
          background: 'rgb(var(--surface-raised))',
          border: '1px solid rgb(var(--control-border) / 0.5)',
        }}
        role="group"
        aria-label="Worklist period"
      >
        {SCOPES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setScope(option.id)}
            aria-pressed={scope === option.id}
            // 44px keeps this thumb-sized; it sits next to the map/list toggle
            // which already uses the same floor.
            className="flex min-h-11 items-center rounded-lg px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
            style={
              scope === option.id
                ? { background: 'rgb(var(--card))', color: 'rgb(var(--text-primary))' }
                : { background: 'transparent', color: 'rgb(var(--text-muted))' }
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      <ExportMenu dataset="worklist" filters={{ scope, date: today, site, userId, allocation }} />
    </div>
  )
}
