import { z } from 'zod'
import { localDateKey, localMidnightUtc } from '@/lib/digest/week'

export function calendarDate(value: string): Date {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid calendar date')
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new Error('Invalid calendar date')
  return date
}

export const allocationInput = z
  .object({
    kind: z.enum(['room', 'equipment']),
    targetId: z.string().min(1).max(100),
    date: z.string().refine((value) => {
      try {
        calendarDate(value)
        return true
      } catch {
        return false
      }
    }, 'Invalid calendar date'),
    assigneeId: z.string().min(1).max(100).nullable(),
    revision: z.number().int().min(0).max(2147483646),
  })
  .strict()

export function assignmentDates(anchor: string, scope: 'day' | 'week'): string[] {
  const date = calendarDate(anchor)
  if (scope === 'week') date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return Array.from({ length: scope === 'week' ? 7 : 1 }, (_, offset) => {
    const day = new Date(date)
    day.setUTCDate(day.getUTCDate() + offset)
    return day.toISOString().slice(0, 10)
  })
}

export function assignmentDayStart(date: string): Date {
  const parsed = calendarDate(date)
  return localMidnightUtc(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate())
}

export function nextDate(date: string): string {
  const next = calendarDate(date)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

export function todayAssignmentDate(now = new Date()): Date {
  return calendarDate(localDateKey(now))
}

export function eligibleAssignee(
  user: { role: string; siteId: string | null; isBlocked: boolean; isHidden: boolean } | null,
  siteId: string,
): boolean {
  return (
    !!user &&
    user.siteId === siteId &&
    !user.isHidden &&
    !user.isBlocked &&
    (user.role === 'CLEANER' || user.role === 'HEAD_OF_HOUSEKEEPING')
  )
}

export type AssignmentBadgeData = {
  assigneeId: string | null
  assigneeName: string | null
  revision: number
}
export type AssignmentRow = {
  kind: 'room' | 'equipment'
  targetId: string
  targetName: string
  siteId: string
  siteName: string
  floor: string | null
  date: string
  assignment: AssignmentBadgeData
  due: string[]
  completed: string[]
}
export type AssignmentBoard = {
  dates: string[]
  rows: AssignmentRow[]
  people: { id: string; name: string; siteId: string }[]
  today: string
  truncated: boolean
}
