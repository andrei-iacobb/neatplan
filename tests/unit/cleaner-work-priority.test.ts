import { describe, expect, it } from 'vitest'
import { cleanerWorkPriority, combineCleanerWorkPriorities } from '@/lib/cleaner-work-priority'

const now = new Date('2026-08-21T12:00:00.000Z')

describe('cleaner work priority', () => {
  it('returns no work for an empty service area', () => {
    expect(cleanerWorkPriority([], now)).toBe('NO_WORK')
  })

  it('treats an explicit overdue schedule as overdue', () => {
    expect(cleanerWorkPriority([{
      status: 'OVERDUE',
      lastCompleted: null,
      nextDue: new Date('2026-08-20T09:00:00.000Z'),
    }], now)).toBe('OVERDUE')
  })

  it('keeps a schedule completed today completed until its next occurrence', () => {
    expect(cleanerWorkPriority([{
      status: 'PENDING',
      lastCompleted: new Date('2026-08-21T09:00:00.000Z'),
      nextDue: new Date('2026-08-22T09:00:00.000Z'),
    }], now)).toBe('COMPLETED')
  })

  it('uses the most urgent item for a service-area marker', () => {
    expect(combineCleanerWorkPriorities(['COMPLETED', 'DUE_TODAY', 'OVERDUE'])).toBe('OVERDUE')
  })
})
