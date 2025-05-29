import { ScheduleFrequency } from '@prisma/client'

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
      date.setMonth(date.getMonth() + 1)
      break
    case 'QUARTERLY':
      date.setMonth(date.getMonth() + 3)
      break
    case 'YEARLY':
      date.setFullYear(date.getFullYear() + 1)
      break
    case 'CUSTOM':
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
    case 'YEARLY':
      return 'Yearly'
    case 'CUSTOM':
      return 'Custom'
    default:
      return 'Unknown'
  }
} 