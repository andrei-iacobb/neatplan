import { describe, expect, it } from 'vitest'
import { buildRoomWorkPackage, type RoomScheduleInput } from '@/lib/combined-room-schedule'

const NOW = new Date('2026-08-21T10:00:00.000Z')

function schedule(overrides: Partial<RoomScheduleInput> & Pick<RoomScheduleInput, 'id' | 'title' | 'frequency' | 'nextDue'>): RoomScheduleInput {
  return {
    status: 'PENDING',
    completedToday: false,
    tasks: [],
    ...overrides,
  }
}

describe('buildRoomWorkPackage', () => {
  it('combines schedules due by today and removes cross-schedule overlap', () => {
    const result = buildRoomWorkPackage([
      schedule({
        id: 'daily',
        title: 'Corridors - Daily Cleaning',
        frequency: 'DAILY',
        nextDue: '2026-08-21T08:00:00.000Z',
        tasks: [
          { id: 'daily-window', description: 'Clean inside windows and window ledges; remove cobwebs' },
          { id: 'daily-bin', description: 'Empty the bin' },
        ],
      }),
      schedule({
        id: 'monthly',
        title: 'Corridors - Deep Clean',
        frequency: 'MONTHLY',
        nextDue: '2026-08-21T09:00:00.000Z',
        tasks: [
          {
            id: 'deep-window',
            description: 'Windows and window ledges',
            additionalNotes: 'Clean and buff until smear-free.',
          },
          { id: 'deep-radiator', description: 'Radiators', additionalNotes: 'Steam-clean vented areas.' },
        ],
      }),
    ], NOW)

    expect(result?.scheduleIds).toEqual(['daily', 'monthly'])
    expect(result?.tasks).toHaveLength(3)
    expect(result?.tasks[0]).toMatchObject({
      description: 'Windows and window ledges',
      taskRefs: [
        { scheduleId: 'daily', taskId: 'daily-window' },
        { scheduleId: 'monthly', taskId: 'deep-window' },
      ],
    })
    expect(result?.tasks[0].additionalNotes).toContain('Clean and buff until smear-free.')
    expect(result?.tasks[0].additionalNotes).toContain('Also covers: Clean inside windows')
  })

  it('keeps separate tasks from the same source schedule independently tickable', () => {
    const result = buildRoomWorkPackage([
      schedule({
        id: 'deep',
        title: 'Bathroom - Deep Clean',
        frequency: 'MONTHLY',
        nextDue: '2026-08-21T09:00:00.000Z',
        tasks: [
          { id: 'sink', description: 'Sink and taps' },
          { id: 'shower', description: 'Shower head, hose and taps' },
        ],
      }),
    ], NOW)

    expect(result?.tasks).toHaveLength(2)
  })

  it('uses detailed instructions when a deep-clean task has a terse label', () => {
    const result = buildRoomWorkPackage([
      schedule({
        id: 'daily',
        title: 'Bedroom - Daily Clean',
        frequency: 'DAILY',
        nextDue: '2026-08-21T09:00:00.000Z',
        tasks: [{ id: 'daily-sink', description: 'Clean the ensuite sink and descale taps' }],
      }),
      schedule({
        id: 'deep',
        title: 'Bedroom - Deep Clean',
        frequency: 'MONTHLY',
        nextDue: '2026-08-21T09:00:00.000Z',
        tasks: [{
          id: 'deep-ensuite',
          description: 'Ensuite',
          additionalNotes: 'Clean the shower, sink, taps, toilet and dispensers.',
        }],
      }),
    ], NOW)

    expect(result?.tasks).toHaveLength(1)
    expect(result?.tasks[0].taskRefs).toHaveLength(2)
  })

  it('does not collapse general floor cleaning into a distinct floor-drain task', () => {
    const result = buildRoomWorkPackage([
      schedule({
        id: 'daily',
        title: 'Kitchen - Daily Clean',
        frequency: 'DAILY',
        nextDue: '2026-08-21T09:00:00.000Z',
        tasks: [{ id: 'daily-floor', description: 'Mop floor with food-safe detergent' }],
      }),
      schedule({
        id: 'deep',
        title: 'Kitchen - Deep Clean',
        frequency: 'MONTHLY',
        nextDue: '2026-08-21T09:00:00.000Z',
        tasks: [{ id: 'deep-drain', description: 'Deep clean floor drains and gullies' }],
      }),
    ], NOW)

    expect(result?.tasks).toHaveLength(2)
  })

  it('does not pull tomorrow work into a package that is due today', () => {
    const result = buildRoomWorkPackage([
      schedule({
        id: 'today',
        title: 'Daily Clean',
        frequency: 'DAILY',
        nextDue: '2026-08-21T12:00:00.000Z',
      }),
      schedule({
        id: 'tomorrow',
        title: 'Weekly Clean',
        frequency: 'WEEKLY',
        nextDue: '2026-08-22T12:00:00.000Z',
      }),
    ], NOW)

    expect(result?.scheduleIds).toEqual(['today'])
  })

  it('combines overdue work with work due today', () => {
    const result = buildRoomWorkPackage([
      schedule({
        id: 'overdue',
        title: 'Daily Clean',
        frequency: 'DAILY',
        nextDue: '2026-08-20T08:00:00.000Z',
        status: 'OVERDUE',
      }),
      schedule({
        id: 'today',
        title: 'Weekly Clean',
        frequency: 'WEEKLY',
        nextDue: '2026-08-21T08:00:00.000Z',
      }),
    ], NOW)

    expect(result?.scheduleIds).toEqual(['overdue', 'today'])
    expect(result?.status).toBe('OVERDUE')
  })

  it('returns no work after every schedule has been completed today', () => {
    const result = buildRoomWorkPackage([
      schedule({
        id: 'done',
        title: 'Daily Clean',
        frequency: 'DAILY',
        nextDue: '2026-08-22T08:00:00.000Z',
        completedToday: true,
      }),
    ], NOW)

    expect(result).toBeNull()
  })
})
