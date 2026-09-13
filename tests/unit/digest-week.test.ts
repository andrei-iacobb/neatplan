import { describe, it, expect } from 'vitest'
import {
  digestWeek,
  digestIsDue,
  localDateKey,
  localMidnightUtc,
  localParts,
} from '@/lib/digest/week'

const LONDON = 'Europe/London'
const NEW_YORK = 'America/New_York'

describe('reading the local clock', () => {
  it('reports the local hour, not the UTC one, during BST', () => {
    // 23:30 UTC on 13 June is 00:30 on the 14th in London.
    const parts = localParts(new Date('2026-06-13T23:30:00Z'), LONDON)

    expect(parts.day).toBe(14)
    expect(parts.hour).toBe(0)
    expect(parts.minute).toBe(30)
  })

  it('agrees with UTC in winter, when London has no offset', () => {
    const parts = localParts(new Date('2026-01-13T23:30:00Z'), LONDON)

    expect(parts.day).toBe(13)
    expect(parts.hour).toBe(23)
  })

  it('renders local midnight as hour zero rather than twenty-four', () => {
    // Some ICU versions format midnight as "24" under hour12: false, which would
    // make every "is it past the send hour" check wrong exactly at midnight.
    expect(localParts(new Date('2026-01-13T00:00:00Z'), LONDON).hour).toBe(0)
  })

  it('numbers weekdays the ISO way, Monday first', () => {
    expect(localParts(new Date('2026-09-14T12:00:00Z'), LONDON).weekday).toBe(1) // Monday
    expect(localParts(new Date('2026-09-20T12:00:00Z'), LONDON).weekday).toBe(7) // Sunday
  })
})

describe('local date keys', () => {
  it('names the day a person would name, not the UTC one', () => {
    // The bug this exists to stop: a delivery recorded against the wrong day,
    // so the idempotency key does not match and the digest sends twice.
    expect(localDateKey(new Date('2026-06-13T23:30:00Z'), LONDON)).toBe('2026-06-14')
    expect(localDateKey(new Date('2026-01-13T23:30:00Z'), LONDON)).toBe('2026-01-13')
  })

  it('works west of Greenwich too', () => {
    // 02:00 UTC on the 14th is still the evening of the 13th in New York.
    expect(localDateKey(new Date('2026-06-14T02:00:00Z'), NEW_YORK)).toBe('2026-06-13')
  })
})

describe('local midnight', () => {
  it('resolves to the right instant in winter and in summer', () => {
    // London is UTC+0 in January and UTC+1 in July, so the same local midnight
    // is a different UTC instant.
    expect(localMidnightUtc(2026, 1, 15, LONDON).toISOString()).toBe('2026-01-15T00:00:00.000Z')
    expect(localMidnightUtc(2026, 7, 15, LONDON).toISOString()).toBe('2026-07-14T23:00:00.000Z')
  })

  it('lands on the correct local day either side of a clock change', () => {
    // BST begins 29 March 2026 and ends 25 October 2026.
    for (const [month, day] of [
      [3, 28],
      [3, 29],
      [3, 30],
      [10, 24],
      [10, 25],
      [10, 26],
    ] as const) {
      const midnight = localMidnightUtc(2026, month, day, LONDON)
      const parts = localParts(midnight, LONDON)

      expect(`${parts.month}-${parts.day}-${parts.hour}`, `${month}/${day}`).toBe(`${month}-${day}-0`)
    }
  })

  it('handles a zone where the clocks change at midnight itself', () => {
    // Lord Howe shifts by 30 minutes; a naive whole-hour correction gets this wrong.
    const midnight = localMidnightUtc(2026, 6, 15, 'Australia/Lord_Howe')
    const parts = localParts(midnight, 'Australia/Lord_Howe')

    expect(parts.day).toBe(15)
    expect(parts.hour).toBe(0)
  })
})

describe('the digest week', () => {
  it('starts on Monday', () => {
    const week = digestWeek(new Date('2026-09-16T12:00:00Z'), LONDON) // Wednesday
    expect(week.key).toBe('2026-09-14')
  })

  it('treats Sunday as the end of its week, not the start of the next', () => {
    // The classic off-by-one. Sunday 20 September belongs to the week that
    // opened on Monday 14 September.
    expect(digestWeek(new Date('2026-09-20T18:00:00Z'), LONDON).key).toBe('2026-09-14')
  })

  it('gives every day of one week the same key', () => {
    const keys = new Set<string>()
    for (let day = 14; day <= 20; day++) {
      keys.add(digestWeek(new Date(`2026-09-${day}T09:00:00Z`), LONDON).key)
    }

    // Every key must match, or the same week would be delivered more than once.
    expect([...keys]).toEqual(['2026-09-14'])
  })

  it('rolls over to a new key on Monday', () => {
    expect(digestWeek(new Date('2026-09-21T09:00:00Z'), LONDON).key).toBe('2026-09-21')
  })

  it('spans exactly seven local days', () => {
    const week = digestWeek(new Date('2026-09-16T12:00:00Z'), LONDON)
    const hours = (week.end.getTime() - week.start.getTime()) / 3_600_000

    expect(hours).toBe(168)
  })

  it('is still seven local days across a clock change', () => {
    // The week containing 29 March 2026 is 167 hours long, because an hour is
    // skipped. Measuring in days rather than hours is what keeps Sunday inside it.
    const week = digestWeek(new Date('2026-03-30T12:00:00Z'), LONDON)
    const hours = (week.end.getTime() - week.start.getTime()) / 3_600_000

    expect(week.key).toBe('2026-03-30')
    expect([167, 168, 169]).toContain(hours)

    // Whatever the hour count, the boundaries are local midnights.
    expect(localParts(week.start, LONDON).hour).toBe(0)
    expect(localParts(week.end, LONDON).hour).toBe(0)
  })

  it('places the week that loses an hour correctly', () => {
    const week = digestWeek(new Date('2026-03-29T12:00:00Z'), LONDON)
    expect(week.key).toBe('2026-03-23')

    const hours = (week.end.getTime() - week.start.getTime()) / 3_600_000
    expect(hours).toBe(167) // the spring-forward week is an hour short
  })

  it('crosses a year boundary', () => {
    // 1 January 2027 is a Friday; its week opened on 28 December 2026.
    expect(digestWeek(new Date('2027-01-01T12:00:00Z'), LONDON).key).toBe('2026-12-28')
  })

  it('works in a zone behind Greenwich', () => {
    // 02:00 UTC Monday is still Sunday evening in New York, so it belongs to the
    // previous week there.
    expect(digestWeek(new Date('2026-09-21T02:00:00Z'), NEW_YORK).key).toBe('2026-09-14')
    expect(digestWeek(new Date('2026-09-21T02:00:00Z'), LONDON).key).toBe('2026-09-21')
  })
})

describe('when a digest becomes due', () => {
  it('is not due in the small hours of Monday', () => {
    expect(digestIsDue(new Date('2026-09-14T02:00:00Z'), LONDON)).toBe(false)
  })

  it('is due from the send hour on Monday', () => {
    // 07:00 local is 06:00 UTC in September, since London is on BST.
    expect(digestIsDue(new Date('2026-09-14T06:00:00Z'), LONDON)).toBe(true)
  })

  it('stays due for the rest of the week', () => {
    // A deployment that was down on Monday morning still sends when it comes
    // back, rather than skipping the week in silence.
    expect(digestIsDue(new Date('2026-09-17T09:00:00Z'), LONDON)).toBe(true)
    // 21:00 UTC on Sunday is 22:00 local under BST - still inside the week.
    expect(digestIsDue(new Date('2026-09-20T21:00:00Z'), LONDON)).toBe(true)
  })

  it('turns not-due again the moment the next week opens', () => {
    // 23:00 UTC on Sunday is already Monday 00:00 local under BST, so this is the
    // NEXT week and its digest is not due until the send hour. Getting this wrong
    // is how a digest goes out at midnight.
    const instant = new Date('2026-09-20T23:00:00Z')

    expect(digestWeek(instant, LONDON).key).toBe('2026-09-21')
    expect(digestIsDue(instant, LONDON)).toBe(false)
  })

  it('judges the send hour by local time, not UTC', () => {
    // 06:30 UTC on a BST Monday is 07:30 local - due. The same instant in winter
    // would be 06:30 local - not due.
    expect(digestIsDue(new Date('2026-09-14T06:30:00Z'), LONDON)).toBe(true)
    expect(digestIsDue(new Date('2026-01-12T06:30:00Z'), LONDON)).toBe(false)
  })
})
