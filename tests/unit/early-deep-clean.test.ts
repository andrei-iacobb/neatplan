import { describe, it, expect } from 'vitest'
import {
  buildRoomWorkPackage,
  schedulesAvailableEarly,
  type RoomScheduleInput,
} from '@/lib/combined-room-schedule'

const NOW = new Date('2026-09-14T09:00:00')

function schedule(overrides: Partial<RoomScheduleInput> & { id: string }): RoomScheduleInput {
  return {
    title: overrides.id,
    frequency: 'DAILY',
    nextDue: NOW.toISOString(),
    status: 'PENDING',
    completedToday: false,
    tasks: [{ id: `${overrides.id}-task`, description: `Do ${overrides.id}` }],
    ...overrides,
  }
}

/** Due today. */
const daily = schedule({
  id: 'daily',
  title: 'Daily bedroom clean',
  frequency: 'DAILY',
  nextDue: '2026-09-14T00:00:00.000Z',
  tasks: [
    { id: 'daily-bins', description: 'Empty the bins' },
    { id: 'daily-floor', description: 'Mop the floor' },
  ],
})

/** Not due for six weeks. */
const quarterly = schedule({
  id: 'quarterly',
  title: 'Quarterly deep clean',
  frequency: 'QUARTERLY',
  nextDue: '2026-10-26T00:00:00.000Z',
  tasks: [
    { id: 'q-curtains', description: 'Wash the curtains' },
    { id: 'q-skirting', description: 'Scrub the skirting boards' },
  ],
})

describe('what can be brought forward', () => {
  it('offers work that is not due yet', () => {
    const available = schedulesAvailableEarly([daily, quarterly], NOW)

    expect(available.map((entry) => entry.id)).toEqual(['quarterly'])
  })

  it('does not offer what is already due - that is not a choice', () => {
    expect(schedulesAvailableEarly([daily], NOW)).toEqual([])
  })

  it('does not offer something already signed off today', () => {
    const done = { ...quarterly, completedToday: true }
    expect(schedulesAvailableEarly([daily, done], NOW)).toEqual([])
  })

  it('lists the soonest first, so the most reasonable choice is at the top', () => {
    const monthly = schedule({
      id: 'monthly',
      frequency: 'MONTHLY',
      nextDue: '2026-09-28T00:00:00.000Z',
    })
    const yearly = schedule({
      id: 'yearly',
      frequency: 'YEARLY',
      nextDue: '2027-06-01T00:00:00.000Z',
    })

    const available = schedulesAvailableEarly([yearly, quarterly, monthly], NOW)
    expect(available.map((entry) => entry.id)).toEqual(['monthly', 'quarterly', 'yearly'])
  })
})

describe('a visit with nothing brought forward', () => {
  it('is exactly what it was before', () => {
    const pkg = buildRoomWorkPackage([daily, quarterly], NOW)

    expect(pkg?.scheduleIds).toEqual(['daily'])
    expect(pkg?.earlyScheduleIds).toEqual([])
  })

  it('ignores a selection of something that is not offered', () => {
    // A stale id in a URL must not change what is required.
    const pkg = buildRoomWorkPackage([daily, quarterly], NOW, ['does-not-exist'])

    expect(pkg?.scheduleIds).toEqual(['daily'])
  })

  it('ignores a selection of something already completed today', () => {
    const done = { ...quarterly, completedToday: true }
    const pkg = buildRoomWorkPackage([daily, done], NOW, ['quarterly'])

    // Asking to do it early when it is already signed off today is asking to do
    // it twice, which the completion endpoint refuses anyway.
    expect(pkg?.scheduleIds).toEqual(['daily'])
  })
})

describe('daily and quarterly together', () => {
  const pkg = buildRoomWorkPackage([daily, quarterly], NOW, ['quarterly'])

  it('combines both into one checklist', () => {
    expect(pkg?.scheduleIds).toEqual(['daily', 'quarterly'])
  })

  it('says which part was voluntary', () => {
    expect(pkg?.earlyScheduleIds).toEqual(['quarterly'])
  })

  it('does not drop the work that was actually due', () => {
    // The whole invariant: bringing extra work forward is additive. The daily
    // does not stop being required because somebody also chose the quarterly.
    const descriptions = pkg?.tasks.map((task) => task.description) ?? []

    expect(descriptions).toContain('Empty the bins')
    expect(descriptions).toContain('Mop the floor')
  })

  it('includes every task of the schedule brought forward', () => {
    const descriptions = pkg?.tasks.map((task) => task.description) ?? []

    expect(descriptions).toContain('Wash the curtains')
    expect(descriptions).toContain('Scrub the skirting boards')
  })

  it('keeps the due date of the work that was due, not the one added', () => {
    // A combined visit is still due today; adding optional work must not make it
    // look like it is not needed until October.
    expect(pkg?.nextDue.slice(0, 10)).toBe('2026-09-14')
  })

  it('every task still carries a reference back to its own schedule', () => {
    // This is what the completion endpoint validates against, and what makes
    // the all-tasks sign-off hold across both schedules.
    for (const task of pkg?.tasks ?? []) {
      expect(task.taskRefs.length).toBeGreaterThan(0)
      for (const ref of task.taskRefs) {
        expect(['daily', 'quarterly']).toContain(ref.scheduleId)
      }
    }
  })

  it('covers both schedules between them, so neither can be signed off empty', () => {
    const covered = new Set(
      (pkg?.tasks ?? []).flatMap((task) => task.taskRefs.map((ref) => ref.scheduleId))
    )

    expect([...covered].sort()).toEqual(['daily', 'quarterly'])
  })
})

describe('when nothing is due at all', () => {
  it('lets an explicit choice stand on its own', () => {
    const pkg = buildRoomWorkPackage([quarterly], NOW, ['quarterly'])

    expect(pkg?.scheduleIds).toEqual(['quarterly'])
    expect(pkg?.earlyScheduleIds).toEqual(['quarterly'])
  })

  it('still shows the next visit when nothing was chosen', () => {
    // Unchanged behaviour: with nothing due and nothing chosen, the package is
    // whatever comes next.
    const pkg = buildRoomWorkPackage([quarterly], NOW)

    expect(pkg?.scheduleIds).toEqual(['quarterly'])
  })

  it('has nothing to offer once everything is done today', () => {
    const pkg = buildRoomWorkPackage([{ ...daily, completedToday: true }], NOW, ['daily'])
    expect(pkg).toBeNull()
  })
})

describe('overdue work', () => {
  it('is included as due, never as an optional extra', () => {
    const overdue = schedule({
      id: 'overdue',
      frequency: 'WEEKLY',
      nextDue: '2026-09-01T00:00:00.000Z',
      status: 'OVERDUE',
    })

    expect(schedulesAvailableEarly([overdue], NOW)).toEqual([])

    const pkg = buildRoomWorkPackage([overdue, quarterly], NOW, ['quarterly'])
    expect(pkg?.scheduleIds).toEqual(['overdue', 'quarterly'])
    expect(pkg?.status).toBe('OVERDUE')
  })

  it('keeps the package marked overdue even when optional work is added', () => {
    // Adding voluntary work must not make a late room look on time.
    const overdue = schedule({
      id: 'overdue',
      nextDue: '2026-09-01T00:00:00.000Z',
      status: 'OVERDUE',
    })

    expect(buildRoomWorkPackage([overdue, quarterly], NOW, ['quarterly'])?.status).toBe('OVERDUE')
  })
})
