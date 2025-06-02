import { ScheduleFrequency } from '@prisma/client'

/**
 * Maps AI-detected frequency strings to ScheduleFrequency enum values
 */
export function mapFrequencyStringToEnum(frequencyString: string | null): ScheduleFrequency {
  if (!frequencyString) {
    return ScheduleFrequency.WEEKLY // Default fallback
  }

  const frequency = frequencyString.toLowerCase().trim()
  
  // Daily patterns
  if (frequency.includes('daily') || frequency.includes('every day') || frequency.includes('each day')) {
    return ScheduleFrequency.DAILY
  }
  
  // Weekly patterns
  if (frequency.includes('weekly') || frequency.includes('every week') || frequency.includes('once a week')) {
    return ScheduleFrequency.WEEKLY
  }
  
  // Bi-weekly patterns
  if (frequency.includes('bi-weekly') || frequency.includes('biweekly') || 
      frequency.includes('every two weeks') || frequency.includes('fortnightly')) {
    return ScheduleFrequency.BIWEEKLY
  }
  
  // Monthly patterns
  if (frequency.includes('monthly') || frequency.includes('every month') || 
      frequency.includes('once a month') || frequency.includes('per month')) {
    return ScheduleFrequency.MONTHLY
  }
  
  // Quarterly patterns
  if (frequency.includes('quarterly') || frequency.includes('every quarter') || 
      frequency.includes('every 3 months') || frequency.includes('three months') ||
      frequency.includes('after vacancy') || frequency.includes('post-infection')) {
    return ScheduleFrequency.QUARTERLY
  }
  
  // Yearly patterns
  if (frequency.includes('yearly') || frequency.includes('annually') || 
      frequency.includes('every year') || frequency.includes('once a year')) {
    return ScheduleFrequency.YEARLY
  }
  
  // Custom patterns - anything that doesn't fit standard frequencies
  if (frequency.includes('as needed') || frequency.includes('when required') || 
      frequency.includes('irregular') || frequency.includes('variable')) {
    return ScheduleFrequency.CUSTOM
  }
  
  // Default to weekly if we can't determine
  return ScheduleFrequency.WEEKLY
}

/**
 * Gets the primary frequency from a schedule's detected frequency string
 * This is used when the AI detects the main schedule frequency
 */
export function getSchedulePrimaryFrequency(frequencyString: string | null): ScheduleFrequency {
  return mapFrequencyStringToEnum(frequencyString)
}

/**
 * Gets the most common frequency from schedule tasks
 * This analyzes all task frequencies to determine the best default for room assignment
 */
export function inferFrequencyFromTasks(tasks: Array<{ frequency: string | null }>): ScheduleFrequency {
  if (!tasks || tasks.length === 0) {
    return ScheduleFrequency.WEEKLY
  }

  // Count frequency occurrences
  const frequencyCount = new Map<ScheduleFrequency, number>()
  
  tasks.forEach(task => {
    const freq = mapFrequencyStringToEnum(task.frequency)
    frequencyCount.set(freq, (frequencyCount.get(freq) || 0) + 1)
  })
  
  // Return the most common frequency
  let mostCommon: ScheduleFrequency = ScheduleFrequency.WEEKLY
  let maxCount = 0
  
  for (const [freq, count] of frequencyCount.entries()) {
    if (count > maxCount) {
      maxCount = count
      mostCommon = freq
    }
  }
  
  return mostCommon
} 