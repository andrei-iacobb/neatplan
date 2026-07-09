import { describe, it, expect } from 'vitest'
import { calculateNextDueDate, isScheduleOverdue } from '@/lib/schedule-utils'

// Use local-time constructors (new Date(y, m, d)) so assertions match the local-time
// arithmetic the function performs.
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 0, 0)

describe('calculateNextDueDate', () => {
  it('advances DAILY by one day', () => {
    const next = calculateNextDueDate('DAILY', at(2026, 3, 10))
    expect(next.getFullYear()).toBe(2026)
    expect(next.getMonth()).toBe(2) // March
    expect(next.getDate()).toBe(11)
  })

  it('advances WEEKLY by 7 days across a month boundary', () => {
    const next = calculateNextDueDate('WEEKLY', at(2026, 1, 28))
    expect(next.getMonth()).toBe(1) // February
    expect(next.getDate()).toBe(4)
  })

  it('advances BIWEEKLY by 14 days', () => {
    const next = calculateNextDueDate('BIWEEKLY', at(2026, 5, 1))
    expect(next.getMonth()).toBe(4) // May
    expect(next.getDate()).toBe(15)
  })

  it('MONTHLY from Jan 31 clamps to Feb 28 (does NOT skip February)', () => {
    const next = calculateNextDueDate('MONTHLY', at(2026, 1, 31))
    expect(next.getMonth()).toBe(1) // February, not March
    expect(next.getDate()).toBe(28) // 2026 is not a leap year
  })

  it('MONTHLY from Jan 31 clamps to Feb 29 in a leap year', () => {
    const next = calculateNextDueDate('MONTHLY', at(2028, 1, 31))
    expect(next.getMonth()).toBe(1) // February
    expect(next.getDate()).toBe(29) // 2028 is a leap year
  })

  it('MONTHLY from a mid-month date keeps the same day', () => {
    const next = calculateNextDueDate('MONTHLY', at(2026, 6, 15))
    expect(next.getMonth()).toBe(6) // July
    expect(next.getDate()).toBe(15)
  })

  it('QUARTERLY from Nov 30 rolls into the next year and clamps to Feb 28', () => {
    const next = calculateNextDueDate('QUARTERLY', at(2025, 11, 30))
    expect(next.getFullYear()).toBe(2026)
    expect(next.getMonth()).toBe(1) // February
    expect(next.getDate()).toBe(28)
  })

  it('YEARLY from Feb 29 clamps to Feb 28 in a non-leap year', () => {
    const next = calculateNextDueDate('YEARLY', at(2028, 2, 29))
    expect(next.getFullYear()).toBe(2029)
    expect(next.getMonth()).toBe(1) // February
    expect(next.getDate()).toBe(28)
  })

  it('does not mutate the passed-in base date', () => {
    const base = at(2026, 1, 31)
    const before = base.getTime()
    calculateNextDueDate('MONTHLY', base)
    expect(base.getTime()).toBe(before)
  })

  it('throws on an unsupported frequency', () => {
    expect(() => calculateNextDueDate('HOURLY' as any, at(2026, 1, 1))).toThrow()
  })
})

describe('isScheduleOverdue', () => {
  it('is true for a past due date', () => {
    expect(isScheduleOverdue(new Date(Date.now() - 60_000))).toBe(true)
  })

  it('is false for a future due date', () => {
    expect(isScheduleOverdue(new Date(Date.now() + 60_000))).toBe(false)
  })
})
