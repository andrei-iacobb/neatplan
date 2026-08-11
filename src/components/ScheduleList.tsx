'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { Schedule, ScheduleTask } from '@/types/schedule'
import { apiRequest } from '@/lib/url-utils'
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { Spinner } from '@/components/ui/loading'
import { useToast } from './ui/toast-context'
import { useThemeColors } from '@/hooks/useThemeColors'
import { FREQUENCY_OPTIONS, frequencyLabel } from '@/lib/schedule-frequency'

type ScheduleWithRelations = Schedule & {
  tasks: ScheduleTask[]
  sites?: { id: string; name: string }[]
}

interface ScheduleListProps {
  schedules: ScheduleWithRelations[]
  onUpdate: () => void
}

interface DraftTask {
  /** Present when the row already exists server-side. */
  id?: string
  key: string
  description: string
  additionalNotes: string
}

interface Draft {
  title: string
  frequency: string
  tasks: DraftTask[]
}

let taskKeySeq = 0
const blankTask = (): DraftTask => ({ key: `new-${taskKeySeq++}`, description: '', additionalNotes: '' })

function toDraft(schedule: ScheduleWithRelations): Draft {
  return {
    title: schedule.title,
    frequency: schedule.suggestedFrequency ?? '',
    tasks: schedule.tasks.map((t) => ({
      id: t.id,
      key: t.id,
      description: t.description,
      additionalNotes: t.additionalNotes ?? '',
    })),
  }
}

function isDirty(schedule: ScheduleWithRelations, draft: Draft): boolean {
  return JSON.stringify(toDraft(schedule)) !== JSON.stringify(draft)
}

export function ScheduleList({ schedules, onUpdate }: ScheduleListProps) {
  const { showToast } = useToast()
  const tc = useThemeColors()
  const fieldId = useId()

  // A single schedule is open for editing at a time, so an in-flight draft can
  // never be silently shadowed by another card's.
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const isDeleting = useRef<Set<string>>(new Set())
  const titleRef = useRef<HTMLInputElement>(null)
  const focusTaskIndex = useRef<number | null>(null)
  const taskListRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const index = focusTaskIndex.current
    if (index === null) return
    focusTaskIndex.current = null
    taskListRef.current?.querySelectorAll<HTMLInputElement>('input[data-task-description]')[index]?.focus()
  }, [draft])

  const openSchedule = (schedule: ScheduleWithRelations) => {
    // Switching rows mid-save would swap the draft out from under the in-flight
    // requests, and the save would then close whichever schedule was opened next.
    if (isSaving) return
    if (openId === schedule.id) {
      closeSchedule()
      return
    }
    if (openId && draft) {
      const current = schedules.find((s) => s.id === openId)
      if (current && isDirty(current, draft) && !confirm('Discard your unsaved changes to this schedule?')) return
    }
    setOpenId(schedule.id)
    setDraft(toDraft(schedule))
    setError(null)
    requestAnimationFrame(() => titleRef.current?.focus())
  }

  const closeSchedule = () => {
    if (openId && draft) {
      const current = schedules.find((s) => s.id === openId)
      if (current && isDirty(current, draft) && !confirm('Discard your unsaved changes to this schedule?')) return
    }
    setOpenId(null)
    setDraft(null)
    setError(null)
  }

  const patchDraft = (patch: Partial<Draft>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev))

  const updateTask = (index: number, patch: Partial<DraftTask>) =>
    setDraft((prev) =>
      prev ? { ...prev, tasks: prev.tasks.map((t, i) => (i === index ? { ...t, ...patch } : t)) } : prev,
    )

  const addTask = () =>
    setDraft((prev) => {
      if (!prev) return prev
      focusTaskIndex.current = prev.tasks.length
      return { ...prev, tasks: [...prev.tasks, blankTask()] }
    })

  const removeTask = (index: number) =>
    setDraft((prev) => (prev ? { ...prev, tasks: prev.tasks.filter((_, i) => i !== index) } : prev))

  const save = async (schedule: ScheduleWithRelations) => {
    if (!draft || isSaving) return

    const title = draft.title.trim()
    if (!title) {
      setError('Give the schedule a title.')
      titleRef.current?.focus()
      return
    }
    // Existing rows must keep a description (the API rejects a blank one);
    // brand-new blank rows are simply dropped so an accidental "Add task"
    // never blocks a save.
    const tasks = draft.tasks.filter((t) => t.id || t.description.trim())
    // Index against the draft, not the filtered list - dropping a blank new row shifts
    // the filtered indexes and the message would then name the wrong task number.
    const blankExisting = draft.tasks.findIndex((t) => !!t.id && !t.description.trim())
    if (blankExisting !== -1) {
      setError(`Task ${blankExisting + 1} needs a description, or remove the row.`)
      return
    }
    if (tasks.length === 0) {
      setError('A schedule needs at least one task.')
      return
    }

    setError(null)
    setIsSaving(true)

    const failures: string[] = []
    const call = async (label: string, path: string, init: RequestInit) => {
      try {
        const res = await apiRequest(path, init)
        if (!res.ok) failures.push(label)
      } catch {
        failures.push(label)
      }
    }

    try {
      if (title !== schedule.title || draft.frequency !== (schedule.suggestedFrequency ?? '')) {
        await call('schedule details', `/api/schedules/${schedule.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, suggestedFrequency: draft.frequency || null }),
        })
      }

      const keptIds = new Set(tasks.filter((t) => t.id).map((t) => t.id))
      for (const original of schedule.tasks) {
        if (!keptIds.has(original.id)) {
          await call(`deleting "${original.description}"`, `/api/schedules/${schedule.id}/tasks/${original.id}`, {
            method: 'DELETE',
          })
        }
      }

      for (const task of tasks) {
        const description = task.description.trim()
        const additionalNotes = task.additionalNotes.trim() || null
        if (task.id) {
          const original = schedule.tasks.find((t) => t.id === task.id)
          if (original && original.description === description && (original.additionalNotes ?? '') === (additionalNotes ?? '')) {
            continue
          }
          // The task route exposes PUT (not PATCH) for updates.
          await call(`updating "${description}"`, `/api/schedules/${schedule.id}/tasks/${task.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description, frequency: original?.frequency ?? null, additionalNotes }),
          })
        } else {
          await call(`adding "${description}"`, `/api/schedules/${schedule.id}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description, additionalNotes }),
          })
        }
      }

      if (failures.length > 0) {
        setError(`Some changes could not be saved: ${failures.join(', ')}.`)
        showToast('Some changes could not be saved', 'error')
        // Close so the next open reloads canonical state from `onUpdate()`. Keeping the
        // stale draft meant any task that DID get created still had no id locally, so a
        // retry would POST it a second time and silently duplicate it.
        setOpenId(null)
        setDraft(null)
      } else {
        showToast('Schedule saved', 'success')
        setOpenId(null)
        setDraft(null)
      }
    } finally {
      setIsSaving(false)
      onUpdate()
    }
  }

  const deleteSchedule = async (scheduleId: string) => {
    if (!confirm('Delete this schedule and all of its tasks?')) return
    if (isDeleting.current.has(scheduleId)) return

    isDeleting.current.add(scheduleId)
    setDeletedIds((prev) => new Set([...prev, scheduleId]))
    try {
      const res = await apiRequest(`/api/schedules/${scheduleId}`, { method: 'DELETE' })
      if (!res.ok) {
        setDeletedIds((prev) => {
          const next = new Set(prev)
          next.delete(scheduleId)
          return next
        })
        throw new Error('Failed to delete schedule')
      }
      showToast('Schedule deleted', 'success')
      setOpenId(null)
      setDraft(null)
      onUpdate()
    } catch {
      showToast('Failed to delete schedule', 'error')
    } finally {
      isDeleting.current.delete(scheduleId)
    }
  }

  const inputStyle = { background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }
  const visible = schedules.filter((s) => !deletedIds.has(s.id))

  return (
    <div className="space-y-3">
      {visible.map((schedule) => {
        const isOpen = openId === schedule.id
        const panelId = `${fieldId}-${schedule.id}-panel`
        const freq = frequencyLabel(schedule.suggestedFrequency)

        return (
          <div
            key={schedule.id}
            className="group rounded-xl overflow-hidden"
            style={{
              background: tc.cardBg,
              border: `1px solid ${isOpen ? tc.cardHoverBorder(tc.accentGreen) : tc.cardBorder}`,
              boxShadow: tc.shadow,
            }}
          >
            <div className="flex items-center justify-between gap-3 p-5">
              <button
                type="button"
                onClick={() => openSchedule(schedule)}
                disabled={isSaving && !isOpen}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex items-start gap-3 flex-1 text-left min-w-0 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <ChevronDown
                  className="h-5 w-5 mt-0.5 shrink-0 transition-transform duration-200"
                  style={{ color: tc.textMuted, transform: isOpen ? 'none' : 'rotate(-90deg)' }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-[17px] font-medium" style={{ color: tc.textPrimary }}>
                      {schedule.title}
                    </h3>
                    <span className="text-[12px] tabular-nums" style={{ color: tc.textMuted }}>
                      · {schedule.tasks.length} {schedule.tasks.length === 1 ? 'task' : 'tasks'}
                    </span>
                    {!isOpen && (
                      <span
                        className="text-[11px] font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: tc.textFaint }}
                      >
                        <Pencil className="w-3 h-3" aria-hidden="true" />
                        Click to edit
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {freq && (
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: tc.chipBg(true), color: tc.accentGreen }}
                      >
                        {freq}
                      </span>
                    )}
                    {schedule.sites?.map((site) => (
                      <span
                        key={site.id}
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: tc.surfaceBg, border: `1px solid ${tc.divider}`, color: tc.textSecondary }}
                      >
                        {site.name}
                      </span>
                    ))}
                  </div>
                  {schedule.detectedFrequency && (
                    <p className="mt-2 text-[12px]" style={{ color: tc.textFaint }}>
                      AI read this as “{schedule.detectedFrequency}” in the source document.
                    </p>
                  )}
                </div>
              </button>
            </div>

            {isOpen && draft && (
              <div id={panelId} className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: tc.divider }}>
                <div className="grid gap-3 sm:grid-cols-2 pt-4">
                  <div>
                    <label
                      htmlFor={`${panelId}-title`}
                      className="block text-[12px] font-medium mb-1.5"
                      style={{ color: tc.textSecondary }}
                    >
                      Title
                    </label>
                    <input
                      id={`${panelId}-title`}
                      ref={titleRef}
                      value={draft.title}
                      onChange={(e) => patchDraft({ title: e.target.value })}
                      disabled={isSaving}
                      className="w-full px-3 py-2 rounded-lg text-[14px] outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`${panelId}-frequency`}
                      className="block text-[12px] font-medium mb-1.5"
                      style={{ color: tc.textSecondary }}
                    >
                      Frequency
                    </label>
                    <select
                      id={`${panelId}-frequency`}
                      value={draft.frequency}
                      onChange={(e) => patchDraft({ frequency: e.target.value })}
                      disabled={isSaving}
                      className="w-full px-3 py-2 rounded-lg text-[14px] outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                      style={inputStyle}
                    >
                      <option value="">No frequency set</option>
                      {FREQUENCY_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <span className="block text-[12px] font-medium mb-1.5" style={{ color: tc.textSecondary }}>
                    Tasks
                  </span>
                  <ul ref={taskListRef} className="space-y-2">
                    {draft.tasks.map((task, i) => (
                      <li
                        key={task.key}
                        className="rounded-lg p-2.5 flex items-start gap-2"
                        style={{ background: tc.surfaceBg, border: `1px solid ${tc.divider}` }}
                      >
                        <span
                          className="mt-2 w-5 shrink-0 text-[11px] text-right tabular-nums"
                          style={{ color: tc.textFaint }}
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <input
                            data-task-description=""
                            value={task.description}
                            onChange={(e) => updateTask(i, { description: e.target.value })}
                            disabled={isSaving}
                            placeholder="Task description"
                            aria-label={`Task ${i + 1} description`}
                            className="w-full px-2.5 py-1.5 rounded-md text-[13px] outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                            style={inputStyle}
                          />
                          <input
                            value={task.additionalNotes}
                            onChange={(e) => updateTask(i, { additionalNotes: e.target.value })}
                            disabled={isSaving}
                            placeholder="Notes (optional)"
                            aria-label={`Task ${i + 1} notes`}
                            className="w-full px-2.5 py-1.5 rounded-md text-[12px] outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                            style={inputStyle}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTask(i)}
                          disabled={isSaving}
                          aria-label={`Remove task ${i + 1}`}
                          title={`Remove task ${i + 1}`}
                          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-md transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500/50 active:scale-[0.94] disabled:opacity-50"
                          style={{ background: tc.btnDangerBg, color: tc.btnDangerText, border: `1px solid ${tc.btnDangerBorder}` }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={addTask}
                    disabled={isSaving}
                    className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.97] disabled:opacity-50"
                    style={{ background: tc.btnSecondaryBg, color: tc.btnSecondaryText, border: `1px solid ${tc.btnSecondaryBorder}` }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add task
                  </button>
                </div>

                {error && (
                  <p role="alert" className="text-[12px]" style={{ color: tc.statusOverdue.text }}>
                    {error}
                  </p>
                )}

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => deleteSchedule(schedule.id)}
                    disabled={isSaving || isDeleting.current.has(schedule.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500/50 active:scale-[0.97] disabled:opacity-50"
                    style={{ background: tc.btnDangerBg, color: tc.btnDangerText, border: `1px solid ${tc.btnDangerBorder}` }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete schedule
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={closeSchedule}
                      disabled={isSaving}
                      className="px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.97] disabled:opacity-50"
                      style={{ background: tc.btnSecondaryBg, color: tc.btnSecondaryText, border: `1px solid ${tc.btnSecondaryBorder}` }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => save(schedule)}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.97] disabled:opacity-60"
                      style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: `1px solid ${tc.btnPrimaryBorder}` }}
                    >
                      {isSaving && <Spinner />}
                      {isSaving ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
