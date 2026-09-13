/**
 * Week boundaries for the weekly digest, in the site's own timezone.
 *
 * Server-local time is not good enough here. A digest that says "this week" has
 * to agree with what a manager sees on a wall planner, and a container
 * scheduled by someone else runs in UTC as often as not. Through British Summer
 * Time that is an hour out, which is enough to put a Monday-morning send into
 * the previous week and to file Sunday-evening work under the wrong heading.
 *
 * The zone is configurable and defaults to Europe/London, which is where the
 * care homes this serves are.
 */

/** Overridden per deployment; the default is where the sites actually are. */
export const DIGEST_TIMEZONE = process.env.DIGEST_TIMEZONE || 'Europe/London'

export interface LocalDateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  /** 1 = Monday through 7 = Sunday, matching ISO. */
  weekday: number
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
}

/**
 * What the clock says in `timeZone` at this instant.
 *
 * Intl is doing the hard part: it knows when the offset changes and by how much,
 * which is not something to reimplement from a table.
 */
export function localParts(instant: Date, timeZone: string = DIGEST_TIMEZONE): LocalDateParts {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  })

  const parts: Record<string, string> = {}
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = part.value
  }

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // 24-hour formatting renders midnight as "24" in some ICU versions.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 1,
  }
}

/**
 * `YYYY-MM-DD` for the local calendar day containing `instant`.
 *
 * This is the key a delivery is recorded against, so it must be the day a person
 * would name - not whatever UTC happened to be at the time.
 */
export function localDateKey(instant: Date, timeZone: string = DIGEST_TIMEZONE): string {
  const { year, month, day } = localParts(instant, timeZone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * The UTC instant corresponding to local midnight on a given calendar day.
 *
 * Found by probing rather than by adding an offset: the offset itself depends on
 * the date, and on the two days a year when the clocks change it differs either
 * side of the boundary. Guessing from UTC midnight and correcting by the
 * difference converges in one step for every real zone.
 */
export function localMidnightUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string = DIGEST_TIMEZONE
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
  const seen = localParts(guess, timeZone)

  const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute)
  const wantedAsUtc = Date.UTC(year, month - 1, day, 0, 0)

  const corrected = new Date(guess.getTime() + (wantedAsUtc - seenAsUtc))

  const check = localParts(corrected, timeZone)
  if (check.year === year && check.month === month && check.day === day && check.hour === 0) {
    return corrected
  }

  /*
   * One correction is exact for every zone whose offset is constant across the
   * boundary. It is not when the clocks change AT local midnight - a few zones
   * do this, and 00:00 then does not exist at all on that date.
   *
   * A second pass is attempted, but its result is CHECKED rather than trusted.
   * Applying the same correction blindly overshoots straight back across the
   * transition and lands on the previous day, which is a whole day wrong rather
   * than an hour - far worse than the problem it was meant to solve.
   *
   * When neither pass lands on local midnight, the first correction is returned:
   * it is the closest real instant to the midnight that did not happen, and it
   * is on the right date.
   */
  const checkAsUtc = Date.UTC(check.year, check.month - 1, check.day, check.hour, check.minute)
  const second = new Date(corrected.getTime() + (wantedAsUtc - checkAsUtc))
  const secondCheck = localParts(second, timeZone)

  if (
    secondCheck.year === year &&
    secondCheck.month === month &&
    secondCheck.day === day &&
    secondCheck.hour === 0
  ) {
    return second
  }

  // Prefer whichever of the two is at least on the right calendar day.
  if (check.year === year && check.month === month && check.day === day) return corrected
  if (secondCheck.year === year && secondCheck.month === month && secondCheck.day === day) {
    return second
  }
  return corrected
}

export interface DigestWeek {
  /** Monday 00:00 local, as a UTC instant. */
  start: Date
  /** The following Monday 00:00 local, exclusive. */
  end: Date
  /** `YYYY-MM-DD` of the Monday. The idempotency key for a delivery. */
  key: string
}

/**
 * The Monday-to-Sunday week containing `instant`, in the given zone.
 *
 * Monday because that is how a cleaning rota is read, and because the digest
 * goes out at the start of the working week.
 */
export function digestWeek(instant: Date, timeZone: string = DIGEST_TIMEZONE): DigestWeek {
  const { year, month, day, weekday } = localParts(instant, timeZone)

  // Step back to Monday using a UTC calendar purely for the arithmetic, then
  // resolve that calendar day back to a real local midnight.
  const asCalendar = new Date(Date.UTC(year, month - 1, day))
  asCalendar.setUTCDate(asCalendar.getUTCDate() - (weekday - 1))

  const start = localMidnightUtc(
    asCalendar.getUTCFullYear(),
    asCalendar.getUTCMonth() + 1,
    asCalendar.getUTCDate(),
    timeZone
  )

  const nextCalendar = new Date(asCalendar)
  nextCalendar.setUTCDate(nextCalendar.getUTCDate() + 7)
  const end = localMidnightUtc(
    nextCalendar.getUTCFullYear(),
    nextCalendar.getUTCMonth() + 1,
    nextCalendar.getUTCDate(),
    timeZone
  )

  return {
    start,
    end,
    key: `${asCalendar.getUTCFullYear()}-${String(asCalendar.getUTCMonth() + 1).padStart(2, '0')}-${String(
      asCalendar.getUTCDate()
    ).padStart(2, '0')}`,
  }
}

/**
 * Hour of the local morning the digest is sent, 0-23. Before this the week's
 * digest is not yet due, so a scheduler tick at 02:00 on Monday does nothing.
 */
export const DIGEST_SEND_HOUR = Math.min(
  23,
  Math.max(0, Number(process.env.DIGEST_SEND_HOUR ?? 7) || 0)
)

/**
 * Is the current week's digest due to go out yet?
 *
 * True from the send hour on Monday until the end of the week, so a deployment
 * that was down on Monday morning still sends when it comes back rather than
 * skipping the week silently.
 */
export function digestIsDue(instant: Date, timeZone: string = DIGEST_TIMEZONE): boolean {
  const { weekday, hour } = localParts(instant, timeZone)
  if (weekday > 1) return true
  return hour >= DIGEST_SEND_HOUR
}
