'use client'

import { CalendarClock, Plus, X } from 'lucide-react'

export interface EarlyScheduleOption {
  id: string
  title: string
  frequency: string
  nextDue: string
  taskCount: number
  estimatedDuration?: string
}

interface EarlyWorkPickerProps {
  options: EarlyScheduleOption[]
  selected: string[]
  onChange: (next: string[]) => void
  /** Something is already due today, so this is genuinely extra. */
  hasDueWork: boolean
  disabled?: boolean
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `4 Nov`, or `4 Nov 2027` when it is far enough out that the year matters. */
function formatDue(iso: string, now = new Date()): string {
  const due = new Date(iso)
  if (Number.isNaN(due.getTime())) return ''

  const base = `${due.getDate()} ${MONTHS[due.getMonth()]}`
  return due.getFullYear() === now.getFullYear() ? base : `${base} ${due.getFullYear()}`
}

/** `in 6 weeks`, which is what actually decides whether doing it now is sensible. */
function formatDistance(iso: string, now = new Date()): string {
  const due = new Date(iso)
  if (Number.isNaN(due.getTime())) return ''

  const startOfDay = (date: Date) => {
    const copy = new Date(date)
    copy.setHours(0, 0, 0, 0)
    return copy.getTime()
  }

  const days = Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000)
  if (days <= 1) return 'tomorrow'
  if (days < 14) return `in ${days} days`
  if (days < 60) return `in ${Math.round(days / 7)} weeks`
  return `in ${Math.round(days / 30)} months`
}

function humanizeFrequency(value: string): string {
  const words = value.replace(/_/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Bring work forward that is not due yet.
 *
 * The case this exists for: a resident is out for the afternoon, the room is
 * empty, and the quarterly deep clean is six weeks away. Doing it now is the
 * sensible thing and there was previously no way to record it.
 *
 * Strictly additive. Whatever is due today stays required, every task of both
 * still has to be ticked, and choosing nothing leaves the visit exactly as it
 * was. The real next due date is on every row, because "not due until 4 November"
 * is the context somebody needs to decide.
 */
export function EarlyWorkPicker({
  options,
  selected,
  onChange,
  hasDueWork,
  disabled,
}: EarlyWorkPickerProps) {
  if (options.length === 0) return null

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id])
  }

  return (
    <section
      className="mb-8 rounded-xl p-4 sm:p-5"
      style={{
        background: 'rgb(var(--card))',
        border: '1px solid rgb(var(--border) / var(--border-alpha))',
      }}
      aria-labelledby="early-work-title"
    >
      <div className="mb-3 flex items-start gap-3">
        <CalendarClock
          className="mt-0.5 h-5 w-5 shrink-0"
          style={{ color: 'rgb(var(--accent))' }}
          aria-hidden="true"
        />
        <div>
          <h2
            id="early-work-title"
            className="text-[16px] font-semibold"
            style={{ color: 'rgb(var(--text-primary))' }}
          >
            Doing anything else while you are here?
          </h2>
          <p className="mt-0.5 text-[13px]" style={{ color: 'rgb(var(--text-muted))' }}>
            {hasDueWork
              ? 'These are not due yet. Add one and it joins today’s checklist - what is already due still has to be done.'
              : 'Nothing is due here today. You can still bring one of these forward.'}
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {options.map((option) => {
          const isSelected = selected.includes(option.id)

          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => toggle(option.id)}
                disabled={disabled}
                aria-pressed={isSelected}
                // 56px: pressed with a thumb, often with gloves on.
                className="flex min-h-14 w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 active:scale-[0.99] disabled:opacity-50 motion-reduce:active:scale-100"
                style={{
                  background: isSelected
                    ? 'rgb(var(--primary) / 0.12)'
                    : 'rgb(var(--surface-raised))',
                  border: `1px solid ${
                    isSelected ? 'rgb(var(--primary) / 0.5)' : 'rgb(var(--control-border) / 0.4)'
                  }`,
                }}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: isSelected ? 'rgb(var(--primary))' : 'rgb(var(--card))',
                    color: isSelected ? 'rgb(var(--primary-foreground))' : 'rgb(var(--text-muted))',
                  }}
                  aria-hidden="true"
                >
                  {isSelected ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[15px] font-semibold"
                    style={{ color: 'rgb(var(--text-primary))' }}
                  >
                    {option.title}
                  </span>
                  <span className="block text-[12px]" style={{ color: 'rgb(var(--text-muted))' }}>
                    {humanizeFrequency(option.frequency)} &middot; {option.taskCount}{' '}
                    {option.taskCount === 1 ? 'task' : 'tasks'}
                    {option.estimatedDuration ? ` · about ${option.estimatedDuration}` : ''}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span
                    className="block text-[12px] font-semibold"
                    style={{ color: 'rgb(var(--text-secondary))' }}
                  >
                    {formatDue(option.nextDue)}
                  </span>
                  <span className="block text-[11px]" style={{ color: 'rgb(var(--text-muted))' }}>
                    {formatDistance(option.nextDue)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {selected.length > 0 ? (
        <p className="mt-3 text-[12px]" style={{ color: 'rgb(var(--text-muted))' }}>
          Added to today&apos;s checklist. Signing off moves the next one on from today, not from
          the date it would have been due.
        </p>
      ) : null}
    </section>
  )
}
