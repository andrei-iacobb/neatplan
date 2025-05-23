export interface ScheduleTask {
  id: string
  description: string
  additionalNotes: string | null
  scheduleId: string
  createdAt: Date
  updatedAt: Date
}

export interface Schedule {
  id: string
  title: string
  frequency: string | null
  tasks: ScheduleTask[]
  createdAt: Date
  updatedAt: Date
} 