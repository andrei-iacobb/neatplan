'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ExportMenu } from '@/components/export/export-menu'
import { apiRequest } from '@/lib/url-utils'
import { localDateKey } from '@/lib/digest/week'
import type { AssignmentBoard as Board, AssignmentRow } from '@/lib/work-assignments/policy'

export function AssignmentBoard({
  management = false,
  site,
}: {
  management?: boolean
  site?: string | null
}) {
  const { data: session } = useSession()
  const [date, setDate] = useState(() => localDateKey(new Date()))
  const [scope, setScope] = useState<'day' | 'week'>('day')
  const [person, setPerson] = useState(management ? 'all' : 'mine')
  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const query = new URLSearchParams({ date, scope })
    if (site) query.set('site', site)
    apiRequest(`/api/work-assignments?${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load allocations')
        const data: Board = await response.json()
        if (!cancelled) setBoard(data)
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : 'Could not load allocations')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [date, scope, site, version])

  const visible =
    board?.rows.filter(
      (row) =>
        person === 'all' ||
        (person === 'unassigned'
          ? !row.assignment.assigneeId
          : row.assignment.assigneeId === (person === 'mine' ? session?.user.id : person)),
    ) ?? []
  const active = visible.filter(
    (row) => management || row.assignment.assigneeId || row.due.length || row.completed.length,
  )
  const userId =
    person === 'mine'
      ? session?.user.id
      : !['all', 'unassigned'].includes(person)
        ? person
        : undefined

  return (
    <section
      className="rounded-xl border border-[rgb(var(--control-border))] bg-[rgb(var(--card))] p-4 space-y-4"
      aria-label={management ? 'Allocate work' : 'My planned work'}
    >
      <div>
        <h2 className="text-lg font-semibold">{management ? 'Allocate work' : 'Planned work'}</h2>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          One person per room or item each day. Colleagues can cover the work. Due tasks still need
          completing.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3" data-print-hide>
        <label className="text-sm">
          Date
          <Input
            aria-label="Allocation date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 min-h-11 w-44"
          />
        </label>
        <label className="text-sm">
          Period
          <select
            aria-label="Allocation period"
            value={scope}
            onChange={(event) => setScope(event.target.value === 'week' ? 'week' : 'day')}
            className="block mt-1 min-h-11 rounded-md border bg-[rgb(var(--card))] px-3"
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
          </select>
        </label>
        <label className="text-sm">
          Worklist
          <select
            aria-label="Allocation person"
            value={person}
            onChange={(event) => setPerson(event.target.value)}
            className="block mt-1 min-h-11 max-w-64 rounded-md border bg-[rgb(var(--card))] px-3"
          >
            <option value="mine">My work</option>
            <option value="unassigned">Unassigned</option>
            <option value="all">All site work</option>
            {management &&
              board?.people.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
          </select>
        </label>
        <ExportMenu
          dataset="worklist"
          filters={{
            date,
            scope,
            site,
            userId,
            allocation:
              person === 'unassigned' ? 'unassigned' : person === 'all' ? 'all' : 'person',
          }}
        />
      </div>
      {loading ? (
        <p role="status">Loading allocations...</p>
      ) : error ? (
        <div role="alert">
          {error}{' '}
          <Button variant="outline" onClick={() => setVersion((value) => value + 1)}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {board?.truncated && (
            <p role="status">
              This site has more than 500 rooms or items. Narrow the site filter to see a complete
              list.
            </p>
          )}
          <p className="text-sm text-[rgb(var(--text-muted))]">
            {active.length} planned visits shown.{' '}
            {board?.rows.filter((row) => !row.assignment.assigneeId && row.due.length > 0).length ??
              0}{' '}
            unassigned visits have work due across this period.{' '}
            <button type="button" className="underline min-h-11" onClick={() => setPerson('all')}>
              See all site work
            </button>
          </p>
          {active.length === 0 ? (
            <p>No work matches this person and period. Unassigned work remains in the site list.</p>
          ) : (
            board?.dates.map((day) => {
              const rows = active.filter((row) => row.date === day)
              if (!rows.length) return null
              return (
                <div key={day} className="space-y-2">
                  <h3 className="font-semibold tabular-nums">{day}</h3>
                  <div className="divide-y border-y">
                    {rows.map((row) => (
                      <AllocationRow
                        key={`${row.kind}:${row.targetId}:${row.date}:${row.assignment.revision}`}
                        row={row}
                        people={board.people}
                        editable={management && day >= board.today}
                        onSaved={() => setVersion((value) => value + 1)}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </>
      )}
    </section>
  )
}

function AllocationRow({
  row,
  people,
  editable,
  onSaved,
}: {
  row: AssignmentRow
  people: Board['people']
  editable: boolean
  onSaved: () => void
}) {
  const [person, setPerson] = useState(row.assignment.assigneeId || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function save(clear = false) {
    setSaving(true)
    setError(null)
    try {
      const response = await apiRequest('/api/work-assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: row.kind,
          targetId: row.targetId,
          date: row.date,
          assigneeId: clear ? null : person || null,
          revision: row.assignment.revision,
        }),
      })
      const body = await response.json()
      if (!response.ok)
        throw new Error(typeof body.error === 'string' ? body.error : 'Could not save allocation')
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save allocation')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="py-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {row.targetName}{' '}
          <span className="text-sm font-normal text-[rgb(var(--text-muted))]">
            {row.kind} · {row.siteName}
            {row.floor ? ` · ${row.floor}` : ''}
          </span>
        </p>
        <p className="text-sm">Assigned to {row.assignment.assigneeName || 'nobody'}</p>
        {row.due.length > 0 && (
          <p className="text-sm text-[rgb(var(--text-muted))]">Due: {row.due.join(', ')}</p>
        )}
        {row.completed.length > 0 && (
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Completed: {row.completed.join(', ')}
          </p>
        )}
        {!row.due.length && !row.completed.length && (
          <p className="text-sm text-[rgb(var(--text-muted))]">
            No work currently due. An early clean can be selected on the checklist.
          </p>
        )}
      </div>
      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={`Assign ${row.targetName} on ${row.date}`}
            value={person}
            onChange={(event) => setPerson(event.target.value)}
            disabled={saving}
            className="min-h-11 max-w-60 rounded-md border bg-[rgb(var(--card))] px-3"
          >
            <option value="">Unassigned</option>
            {people
              .filter((member) => member.siteId === row.siteId)
              .map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
          </select>
          <Button
            disabled={saving || person === (row.assignment.assigneeId || '')}
            onClick={() => save()}
          >
            Save
          </Button>
          {row.assignment.assigneeId && (
            <Button variant="outline" disabled={saving} onClick={() => save(true)}>
              Clear
            </Button>
          )}
          {error && (
            <p role="alert" className="basis-full text-sm">
              {error}{' '}
              <button type="button" className="underline min-h-11" onClick={onSaved}>
                Reload
              </button>
            </p>
          )}
        </div>
      ) : (
        <Link
          className="inline-flex min-h-11 items-center text-sm font-medium underline"
          href={row.kind === 'room' ? `/clean/${row.targetId}` : `/clean/equipment/${row.targetId}`}
        >
          Open checklist
        </Link>
      )}
    </div>
  )
}
