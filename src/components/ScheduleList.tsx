'use client'

import { useState, useCallback, useRef } from 'react'
import { ScheduleFrequency } from '@prisma/client'
import type { Schedule, ScheduleTask } from '@/types/schedule'
import { apiRequest } from '@/lib/url-utils'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ChevronDown, Pencil, Plus, Save, Trash, X } from 'lucide-react'
import { useToast } from './ui/toast-context'
import { useThemeColors } from '@/hooks/useThemeColors'

interface ScheduleListProps {
  schedules: (Schedule & { tasks: ScheduleTask[]; sites?: { id: string; name: string }[] })[]
  onUpdate: () => void
  isEditMode: boolean
}

export function ScheduleList({ schedules, onUpdate, isEditMode }: ScheduleListProps) {
  const { showToast } = useToast()
  const tc = useThemeColors()
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newSuggestedFrequency, setNewSuggestedFrequency] = useState<ScheduleFrequency | ''>('')
  const [newTask, setNewTask] = useState({
    description: '',
    additionalNotes: ''
  })
  const [deletedScheduleIds, setDeletedScheduleIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const isDeleting = useRef<Set<string>>(new Set())

  const toggleExpanded = (id: string) => setExpandedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const updateSchedule = async (scheduleId: string) => {
    try {
      const response = await apiRequest(`/api/schedules/${scheduleId}`, {
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

      const response = await apiRequest(`/api/schedules/${scheduleId}`, {
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
      const response = await apiRequest(`/api/schedules/${scheduleId}/tasks/${taskId}`, {
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
      const response = await apiRequest(`/api/schedules/${scheduleId}/tasks/${taskId}`, {
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
      const response = await apiRequest(`/api/schedules/${scheduleId}/tasks`, {
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
    <div className="space-y-3">
      {visibleSchedules.map(schedule => {
        const isExpanded = expandedIds.has(schedule.id)
        const isEditingThis = editingSchedule === schedule.id
        return (
        <div
          key={schedule.id}
          className="rounded-xl overflow-hidden"
          style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}
        >
          {isEditingThis ? (
            <div className="flex items-start gap-2 p-5">
              <div className="flex-1 space-y-2">
                <Input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Schedule title"
                  style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }}
                />
                <select
                  value={newSuggestedFrequency}
                  onChange={e => setNewSuggestedFrequency(e.target.value as ScheduleFrequency)}
                  className="w-full rounded-md px-3 py-2"
                  style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                >
                  <option value="">No frequency suggested</option>
                  {Object.values(ScheduleFrequency).map((freq) => (
                    <option key={freq} value={freq}>
                      {freq}
                    </option>
                  ))}
                </select>
                <p className="text-xs" style={{ color: tc.textMuted }}>
                  💡 This overrides the AI suggestion and becomes the default for room assignments
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => updateSchedule(schedule.id)} style={{ color: tc.textMuted }}>
                <Save className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setEditingSchedule(null)} style={{ color: tc.textMuted }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 p-5">
              <button
                type="button"
                onClick={() => toggleExpanded(schedule.id)}
                aria-expanded={isExpanded}
                className="flex items-start gap-3 flex-1 text-left min-w-0"
              >
                <ChevronDown
                  className="h-5 w-5 mt-0.5 flex-shrink-0 transition-transform duration-200"
                  style={{ color: tc.textMuted, transform: isExpanded ? 'none' : 'rotate(-90deg)' }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[17px] font-medium" style={{ color: tc.textPrimary }}>{schedule.title}</h3>
                    <span className="text-[12px]" style={{ color: tc.textMuted }}>· {schedule.tasks.length} {schedule.tasks.length === 1 ? 'task' : 'tasks'}</span>
                  </div>
                  {schedule.sites && schedule.sites.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {schedule.sites.map(site => (
                        <span
                          key={site.id}
                          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: tc.surfaceBg, border: `1px solid ${tc.divider}`, color: tc.textSecondary }}
                        >
                          {site.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {schedule.detectedFrequency && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm flex items-center" style={{ color: tc.accentLabel }}>
                        <span className="mr-1">✨</span>
                        AI Detected: &quot;{schedule.detectedFrequency}&quot; (original)
                      </p>
                      {schedule.suggestedFrequency && (
                        <p className="text-sm flex items-center" style={{ color: tc.accentLabel }}>
                          <span className="mr-1">🎯</span>
                          Current Suggestion: {schedule.suggestedFrequency}
                          <span className="ml-2 text-xs" style={{ color: tc.textMuted }}>(editable)</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </button>
              {isEditMode && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditingSchedule(schedule.id)
                      setNewTitle(schedule.title)
                      setNewSuggestedFrequency(schedule.suggestedFrequency || '')
                    }}
                    style={{ color: tc.textMuted }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteSchedule(schedule.id)}
                    style={{ color: tc.btnDangerText }}
                    disabled={isDeleting.current.has(schedule.id)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {isExpanded && !isEditingThis && (
          <div className="px-5 pb-5 space-y-3">
            {schedule.tasks.length === 0 && (
              <p className="text-[13px]" style={{ color: tc.textMuted }}>No tasks in this schedule yet.</p>
            )}
            {schedule.tasks.map(task => (
              <div
                key={task.id}
                className="flex items-center gap-2 p-4 rounded-lg"
                style={{ background: isEditMode ? tc.surfaceBg : tc.emptyBg }}
              >
                {editingTask === task.id ? (
                  <>
                    <Input
                      value={newTask.description}
                      onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                      placeholder="Task description"
                      className="flex-1"
                      style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => updateTask(schedule.id, task.id, newTask)}
                      style={{ color: tc.textMuted }}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingTask(null)}
                      style={{ color: tc.textMuted }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1">
                      <p style={{ color: tc.textPrimary }}>{task.description}</p>
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
                          style={{ color: tc.textMuted }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteTask(schedule.id, task.id)}
                          style={{ color: tc.btnDangerText }}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}

            {isEditMode && (
              <div className="flex items-center gap-2 mt-4">
                <Input
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="New task description"
                  className="flex-1"
                  style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }}
                />
                <Button
                  onClick={() => addTask(schedule.id)}
                  style={{ background: tc.btnSecondaryBg, borderColor: tc.btnSecondaryBorder, color: tc.btnSecondaryText }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </div>
            )}
          </div>
          )}
        </div>
        )
      })}
    </div>
  )
}
