import { ScheduleFrequency } from '@/generated/prisma/enums'

/**
 * Add whole months to a date, clamping the day to the last valid day of the target month.
 * Plain Date.setMonth overflows (e.g. Jan 31 + 1 month -> Mar 3), which would silently skip
 * a cycle for month-end schedules; this keeps Jan 31 -> Feb 28/29.
 */
function addMonthsClamped(date: Date, months: number): void {
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDayOfMonth))
}

export function calculateNextDueDate(
  frequency: ScheduleFrequency,
  baseDate: Date = new Date()
): Date {
  const date = new Date(baseDate)

  switch (frequency) {
    case 'DAILY':
      date.setDate(date.getDate() + 1)
      break
    case 'WEEKLY':
      date.setDate(date.getDate() + 7)
      break
    case 'BIWEEKLY':
      date.setDate(date.getDate() + 14)
      break
    case 'MONTHLY':
      addMonthsClamped(date, 1)
      break
    case 'QUARTERLY':
      addMonthsClamped(date, 3)
      break
    case 'SEMIANNUAL':
      addMonthsClamped(date, 6)
      break
    case 'YEARLY':
      // Clamp Feb 29 -> Feb 28 in a non-leap target year.
      addMonthsClamped(date, 12)
      break
    default:
      throw new Error(`Unsupported frequency: ${frequency}`)
  }

  return date
}

export function isScheduleOverdue(nextDueDate: Date): boolean {
  return new Date() > nextDueDate
}

export function getFrequencyLabel(frequency: ScheduleFrequency): string {
  switch (frequency) {
    case 'DAILY':
      return 'Daily'
    case 'WEEKLY':
      return 'Weekly'
    case 'BIWEEKLY':
      return 'Bi-weekly'
    case 'MONTHLY':
      return 'Monthly'
    case 'QUARTERLY':
      return 'Quarterly'
    case 'SEMIANNUAL':
      return 'Six Monthly'
    case 'YEARLY':
      return 'Yearly'
    // case 'CUSTOM':
    //   return 'Custom'
    default:
      return 'Unknown'
  }
}

export function getScheduleDisplayName(title: string, frequency?: ScheduleFrequency): string {
  // Clean up the title and extract meaningful parts
  const cleanTitle = title
    .replace(/^(Daily|Weekly|Monthly|Quarterly|Six Monthly|Yearly):\s*/i, '') // Remove frequency prefix
    .replace(/\s*-\s*(bedrooms?|communal|office|bathroom).*$/i, '') // Remove room type suffixes
    .replace(/\s*-\s*infection control.*$/i, '') // Remove infection control suffix
    .replace(/checklist$/i, '') // Remove checklist suffix
    .trim()

  // Extract the first few meaningful words (max 3)
  const words = cleanTitle.split(/\s+/).filter(word => 
    word.length > 2 && // Skip short words
    !['the', 'and', 'for', 'with', 'tool', 'audit'].includes(word.toLowerCase())
  )
  
  const shortTitle = words.slice(0, 3).join(' ')
  
  // If we have a frequency, combine it with the short title
  if (frequency) {
    const freqLabel = getFrequencyLabel(frequency)
    return `${freqLabel} ${shortTitle}`.trim()
  }
  
  // Otherwise, just return the short title
  return shortTitle || title.slice(0, 20) + (title.length > 20 ? '...' : '')
}
