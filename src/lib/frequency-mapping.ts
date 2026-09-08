import { ScheduleFrequency } from '@/generated/prisma/enums'

/**
 * Maps AI-detected frequency strings to ScheduleFrequency enum values
 */
export function mapFrequencyStringToEnum(frequencyString: string | null): ScheduleFrequency | null {
  if (!frequencyString) {
    return null
  }

  const frequency = frequencyString.toLowerCase().trim().replace(/\s+/g, ' ')

  // Match complete, supported occurrences. Substring matching also accepted
  // "not daily", "twice weekly" and "daily or weekly" as definite schedules.
  if (/^(daily|every day|each day|once (a|per) day)$/.test(frequency)) {
    return ScheduleFrequency.DAILY
  }

  if (/^(bi[ -]?weekly|every (two|2) weeks|fortnightly)$/.test(frequency)) {
    return ScheduleFrequency.BIWEEKLY
  }

  if (/^(weekly|every week|each week|once (a|per) week)$/.test(frequency)) {
    return ScheduleFrequency.WEEKLY
  }

  if (/^(quarterly|every quarter|(every )?(three|3) months|(three|3)[ -]monthly)$/.test(frequency)) {
    return ScheduleFrequency.QUARTERLY
  }

  if (/^((every )?(six|6) months|(six|6)[ -]monthly|semi[ -]?annual(ly)?|bi[ -]?annual(ly)?|twice (a|per) year|half[ -]yearly)$/.test(frequency)) {
    return ScheduleFrequency.SEMIANNUAL
  }

  if (/^(monthly|every month|each month|once (a|per) month)$/.test(frequency)) {
    return ScheduleFrequency.MONTHLY
  }

  if (/^(yearly|annual(ly)?|every year|each year|once (a|per) year)$/.test(frequency)) {
    return ScheduleFrequency.YEARLY
  }

  // Import review owns ambiguous values. Guessing here previously made an
  // unrecognised occurrence look confidently weekly.
  return null
}

/**
 * Gets the primary frequency from a schedule's detected frequency string
 * This is used when the AI detects the main schedule frequency
 */
export function getSchedulePrimaryFrequency(frequencyString: string | null): ScheduleFrequency | null {
  return mapFrequencyStringToEnum(frequencyString)
}

/**
 * Gets the most common frequency from schedule tasks
 * This analyzes all task frequencies to determine the best default for room assignment
 */
export function inferFrequencyFromTasks(tasks: Array<{ frequency: string | null }>): ScheduleFrequency | null {
  if (!tasks || tasks.length === 0) {
    return null
  }

  // Count frequency occurrences
  const frequencyCount = new Map<ScheduleFrequency, number>()
  
  tasks.forEach(task => {
    const freq = mapFrequencyStringToEnum(task.frequency)
    if (!freq) return
    frequencyCount.set(freq, (frequencyCount.get(freq) || 0) + 1)
  })
  
  const ranked = [...frequencyCount.entries()].sort((left, right) => right[1] - left[1])
  if (ranked.length === 0 || (ranked[1] && ranked[0][1] === ranked[1][1])) return null
  return ranked[0][0]
}
