export enum ScheduleFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM'
}

export enum ScheduleStatus {
  PENDING = 'PENDING',
  OVERDUE = 'OVERDUE',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED'
}

export interface ScheduleTask {
  id: string
  description: string
  additionalNotes?: string | null
  scheduleId: string
  createdAt: Date
  updatedAt: Date
}

export interface Schedule {
  id: string
  title: string
  detectedFrequency?: string | null
  suggestedFrequency?: ScheduleFrequency | null
  createdAt: Date
  updatedAt: Date
  tasks: ScheduleTask[]
}

export interface RoomSchedule {
  id: string
  roomId: string
  scheduleId: string
  frequency: ScheduleFrequency
  startDate: Date
  lastCompleted?: Date | null
  nextDue: Date
  status: ScheduleStatus
  createdAt: Date
  updatedAt: Date
  schedule: Schedule
} 