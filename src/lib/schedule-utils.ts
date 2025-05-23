import { ScheduleFrequency } from '@/types/schedule'

export function calculateNextDueDate(
  frequency: ScheduleFrequency,
  baseDate: Date = new Date()
): Date {
  const date = new Date(baseDate)

  switch (frequency) {
    case ScheduleFrequency.DAILY:
      date.setDate(date.getDate() + 1)
      break
    case ScheduleFrequency.WEEKLY:
      date.setDate(date.getDate() + 7)
      break
    case ScheduleFrequency.BIWEEKLY:
      date.setDate(date.getDate() + 14)
      break
    case ScheduleFrequency.MONTHLY:
      date.setMonth(date.getMonth() + 1)
      break
    case ScheduleFrequency.QUARTERLY:
      date.setMonth(date.getMonth() + 3)
      break
    case ScheduleFrequency.YEARLY:
      date.setFullYear(date.getFullYear() + 1)
      break
    case ScheduleFrequency.CUSTOM:
      // For custom frequency, default to weekly
      date.setDate(date.getDate() + 7)
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
    case ScheduleFrequency.DAILY:
      return 'Daily'
    case ScheduleFrequency.WEEKLY:
      return 'Weekly'
    case ScheduleFrequency.BIWEEKLY:
      return 'Bi-weekly'
    case ScheduleFrequency.MONTHLY:
      return 'Monthly'
    case ScheduleFrequency.QUARTERLY:
      return 'Quarterly'
    case ScheduleFrequency.YEARLY:
      return 'Yearly'
    case ScheduleFrequency.CUSTOM:
      return 'Custom'
    default:
      return 'Unknown'
  }
} 