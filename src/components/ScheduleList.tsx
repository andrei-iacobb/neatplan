import { useState, useCallback, useRef } from 'react'
import type { Schedule, ScheduleTask } from '@/types/schedule'
import { ScheduleFrequency } from '@/types/schedule'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Pencil, Plus, Save, Trash, X } from 'lucide-react'
import { useToast } from './ui/toast-context'

interface ScheduleListProps {
  schedules: (Schedule & { tasks: ScheduleTask[] })[]
  onUpdate: () => void
  isEditMode: boolean
}

export function ScheduleList({ schedules, onUpdate, isEditMode }: ScheduleListProps) {
  const { showToast } = useToast()
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newSuggestedFrequency, setNewSuggestedFrequency] = useState<ScheduleFrequency | ''>('')
  const [newTask, setNewTask] = useState({
    description: '',
    additionalNotes: ''
  })
  const [deletedScheduleIds, setDeletedScheduleIds] = useState<Set<string>>(new Set())
  const isDeleting = useRef<Set<string>>(new Set())

  const updateSchedule = async (scheduleId: string) => {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: newTitle,
          suggestedFrequency: newSuggestedFrequency || null
        })
      })

      if (!response.ok) throw new Error('Failed to update schedule')
      
      showToast('Schedule updated', 'success')
      setEditingSchedule(null)
      onUpdate()
    } catch (error) {
      showToast('Failed to update schedule', 'error')
    }
  }

  const deleteSchedule = useCallback(async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return
    if (isDeleting.current.has(scheduleId)) return

    try {
      isDeleting.current.add(scheduleId)
      setDeletedScheduleIds(prev => new Set([...prev, scheduleId]))

      const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        setDeletedScheduleIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(scheduleId)
          return newSet
        })
        throw new Error('Failed to delete schedule')
      }
      
      showToast('Schedule deleted', 'success')
      onUpdate()
    } catch (error) {
      showToast('Failed to delete schedule', 'error')
    } finally {
      isDeleting.current.delete(scheduleId)
    }
  }, [onUpdate, showToast])

  const updateTask = async (scheduleId: string, taskId: string, task: typeof newTask) => {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      })

      if (!response.ok) throw new Error('Failed to update task')
      
      showToast('Task updated', 'success')
      setEditingTask(null)
      onUpdate()
    } catch (error) {
      showToast('Failed to update task', 'error')
    }
  }

  const deleteTask = async (scheduleId: string, taskId: string) => {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}/tasks/${taskId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete task')
      
      showToast('Task deleted', 'success')
      onUpdate()
    } catch (error) {
      showToast('Failed to delete task', 'error')
    }
  }

  const addTask = async (scheduleId: string) => {
    if (!newTask.description.trim()) {
      showToast('Please enter a task description', 'error')
      return
    }

    try {
      const response = await fetch(`/api/schedules/${scheduleId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      })

      if (!response.ok) throw new Error('Failed to add task')
      
      showToast('Task added', 'success')
      setNewTask({ description: '', additionalNotes: '' })
      onUpdate()
    } catch (error) {
      showToast('Failed to add task', 'error')
    }
  }

  // Filter out deleted schedules from rendering
  const visibleSchedules = schedules.filter(schedule => !deletedScheduleIds.has(schedule.id))

  return (
    <div className="space-y-6">
      {visibleSchedules.map(schedule => (
        <div key={schedule.id} className={`rounded-lg ${isEditMode ? 'bg-gray-800/50' : ''} p-6`}>
          <div className="flex items-center justify-between mb-4">
            {editingSchedule === schedule.id ? (
              <div className="flex items-center gap-2 flex-1">
                <div className="flex-1 space-y-2">
                  <Input
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="Schedule title"
                    className="bg-gray-800/50 border-gray-700 text-gray-100"
                  />
                  <select
                    value={newSuggestedFrequency}
                    onChange={e => setNewSuggestedFrequency(e.target.value as ScheduleFrequency)}
                    className="w-full rounded-md bg-gray-800/50 border border-gray-700 text-gray-100 px-3 py-2"
                  >
                    <option value="">No frequency suggested</option>
                    {Object.values(ScheduleFrequency).map((freq) => (
                      <option key={freq} value={freq}>
                        {freq}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400">
                    💡 This overrides the AI suggestion and becomes the default for room assignments
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => updateSchedule(schedule.id)}
                  className="text-gray-400 hover:text-gray-300"
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditingSchedule(null)}
                  className="text-gray-400 hover:text-gray-300"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="text-xl font-medium text-gray-100">{schedule.title}</h3>
                  {schedule.detectedFrequency && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-teal-400 flex items-center">
                        <span className="mr-1">✨</span>
                        AI Detected: "{schedule.detectedFrequency}" (original)
                      </p>
                      {schedule.suggestedFrequency && (
                        <p className="text-sm text-teal-300 flex items-center">
                          <span className="mr-1">🎯</span>
                          Current Suggestion: {schedule.suggestedFrequency}
                          <span className="ml-2 text-xs text-gray-400">(editable)</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {isEditMode && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingSchedule(schedule.id)
                        setNewTitle(schedule.title)
                        setNewSuggestedFrequency(schedule.suggestedFrequency || '')
                      }}
                      className="text-gray-400 hover:text-gray-300"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteSchedule(schedule.id)}
                      className="text-red-400 hover:text-red-300"
                      disabled={isDeleting.current.has(schedule.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {schedule.tasks.map(task => (
              <div key={task.id} className={`flex items-center gap-2 p-4 rounded-lg ${
                isEditMode ? 'bg-gray-800/30' : 'bg-gray-800/20'
              }`}>
                {editingTask === task.id ? (
                  <>
                    <Input
                      value={newTask.description}
                      onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                      placeholder="Task description"
                      className="flex-1 bg-gray-800/50 border-gray-700 text-gray-100"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => updateTask(schedule.id, task.id, newTask)}
                      className="text-gray-400 hover:text-gray-300"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingTask(null)}
                      className="text-gray-400 hover:text-gray-300"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1">
                      <p className="text-gray-200">{task.description}</p>
                    </div>
                    {isEditMode && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingTask(task.id)
                            setNewTask({
                              description: task.description,
                              additionalNotes: task.additionalNotes || ''
                            })
                          }}
                          className="text-gray-400 hover:text-gray-300"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteTask(schedule.id, task.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {isEditMode && (
            <div className="flex items-center gap-2 mt-4">
              <Input
                value={newTask.description}
                onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="New task description"
                className="flex-1 bg-gray-800/50 border-gray-700 text-gray-100"
              />
              <Button
                onClick={() => addTask(schedule.id)}
                className="bg-gray-800/50 border-gray-700 hover:bg-gray-800 hover:border-gray-600"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
} 