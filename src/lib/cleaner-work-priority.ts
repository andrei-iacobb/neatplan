export type CleanerWorkPriority = 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'COMPLETED' | 'NO_WORK'

type ScheduleOccurrence = {
  status: string
  lastCompleted: Date | null
  nextDue: Date
}

export function cleanerWorkPriority(
  schedules: readonly ScheduleOccurrence[],
  now = new Date()
): CleanerWorkPriority {
  if (schedules.length === 0) return 'NO_WORK'

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const overdueCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const completedToday = (schedule: ScheduleOccurrence) =>
    schedule.status === 'PENDING' &&
    schedule.lastCompleted !== null &&
    schedule.lastCompleted >= today &&
    schedule.nextDue > now

  if (schedules.some((schedule) =>
    schedule.status === 'OVERDUE' ||
    (schedule.status === 'PENDING' && !completedToday(schedule) && schedule.nextDue < overdueCutoff)
  )) return 'OVERDUE'

  if (schedules.some((schedule) =>
    schedule.status === 'PENDING' &&
    !completedToday(schedule) &&
    schedule.nextDue >= today &&
    schedule.nextDue < tomorrow
  )) return 'DUE_TODAY'

  if (schedules.every((schedule) => schedule.status === 'COMPLETED' || completedToday(schedule))) {
    return 'COMPLETED'
  }

  return 'UPCOMING'
}

const priorityRank: Record<CleanerWorkPriority, number> = {
  OVERDUE: 0,
  DUE_TODAY: 1,
  UPCOMING: 2,
  COMPLETED: 3,
  NO_WORK: 4,
}

export function combineCleanerWorkPriorities(
  priorities: readonly CleanerWorkPriority[]
): CleanerWorkPriority {
  return priorities.reduce<CleanerWorkPriority>(
    (highest, priority) => priorityRank[priority] < priorityRank[highest] ? priority : highest,
    'NO_WORK'
  )
}
