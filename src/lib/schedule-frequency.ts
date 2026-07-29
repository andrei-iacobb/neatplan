import { ScheduleFrequency } from '@/types/schedule'

/**
 * Readable labels for the ScheduleFrequency enum in prisma/schema.prisma.
 * Kept in one place so the create form, the edit panel and any future
 * assignment UI never drift from the enum or from each other.
 */
export const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  [ScheduleFrequency.DAILY]: 'Daily',
  [ScheduleFrequency.WEEKLY]: 'Weekly',
  [ScheduleFrequency.BIWEEKLY]: 'Every 2 weeks',
  [ScheduleFrequency.MONTHLY]: 'Monthly',
  [ScheduleFrequency.QUARTERLY]: 'Every 3 months',
  [ScheduleFrequency.YEARLY]: 'Yearly',
}

export const FREQUENCY_OPTIONS = (Object.keys(FREQUENCY_LABELS) as ScheduleFrequency[]).map(
  (value) => ({ value, label: FREQUENCY_LABELS[value] }),
)

export function frequencyLabel(value?: string | null): string | null {
  if (!value) return null
  return FREQUENCY_LABELS[value as ScheduleFrequency] ?? value
}
