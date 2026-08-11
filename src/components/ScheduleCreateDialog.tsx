'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Spinner } from '@/components/ui/loading'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { ScheduleDropzone, type DraftSchedule } from './ScheduleDropzone'
import { apiRequest } from '@/lib/url-utils'
import { canAccessAllSites } from '@/lib/roles'
import { FREQUENCY_OPTIONS } from '@/lib/schedule-frequency'
import { useThemeColors } from '@/hooks/useThemeColors'
import { fadeUp, transitionFast } from '@/lib/motion'

interface ScheduleCreateDialogProps {
  onScheduleCreated: () => void
  /** Rendered as the dialog trigger. Falls back to a standard "New schedule" button. */
  trigger?: React.ReactNode
}

interface SiteOption {
  id: string
  name: string
}

interface DraftTask {
  key: string
  description: string
  additionalNotes: string
  /**
   * Per-task cadence lifted from an extracted document (a cleaning sheet routinely says
   * "Clean toilet - Daily, Descale - Monthly"). The form does not edit it, but it is
   * carried through to the API so importing a document does not discard it.
   */
  frequency?: string | null
}

let taskKeySeq = 0
const nextKey = () => `t${taskKeySeq++}`
const newTask = (): DraftTask => ({ key: nextKey(), description: '', additionalNotes: '', frequency: null })

interface FormErrors {
  title?: string
  frequency?: string
  tasks?: string
  sites?: string
}

/** What the dropzone filled in, so the change to the fields below is never silent. */
interface PrefillNotice {
  fileName: string
  taskCount: number
  /** True when the extraction overwrote work the user had already typed. */
  replacedInput: boolean
}

const FREQUENCY_VALUES = new Set(FREQUENCY_OPTIONS.map((f) => f.value as string))

export function ScheduleCreateDialog({ onScheduleCreated, trigger }: ScheduleCreateDialogProps) {
  const tc = useThemeColors()
  const { data: session } = useSession()
  // OP/DIRECTOR span every site and pick which ones the schedule applies to;
  // MANAGER/CLEANER are pinned, so the server forces their own site.
  const canPickSite = canAccessAllSites((session?.user as any)?.role)
  const fieldId = useId()

  const [open, setOpen] = useState(false)

  const [title, setTitle] = useState('')
  const [frequency, setFrequency] = useState('')
  const [tasks, setTasks] = useState<DraftTask[]>(() => [newTask()])
  const [sites, setSites] = useState<SiteOption[]>([])
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  // Free text as written in the document. Persisted alongside the enum value so
  // assigning the schedule to a room can prefill it. Never shown in the select.
  const [detectedFrequency, setDetectedFrequency] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<PrefillNotice | null>(null)

  const taskListRef = useRef<HTMLUListElement>(null)
  const focusTaskIndex = useRef<number | null>(null)

  useEffect(() => {
    if (!open || !canPickSite) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiRequest('/api/sites')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setSites(Array.isArray(data) ? data.map((s: any) => ({ id: s.id, name: s.name })) : [])
      } catch {
        /* non-fatal: submit still validates that a site was chosen */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, canPickSite])

  // Move keyboard focus onto a task row that was just added or reordered, so
  // the whole repeater stays operable without a mouse.
  useEffect(() => {
    const index = focusTaskIndex.current
    if (index === null) return
    focusTaskIndex.current = null
    const input = taskListRef.current?.querySelectorAll<HTMLInputElement>('input[data-task-description]')[index]
    input?.focus()
  }, [tasks])

  const reset = () => {
    setTitle('')
    setFrequency('')
    setTasks([newTask()])
    setSelectedSiteIds([])
    setErrors({})
    setIsSaving(false)
    setDetectedFrequency(null)
    setPrefill(null)
  }

  const closeAndRefresh = () => {
    setOpen(false)
    reset()
    onScheduleCreated()
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  /** Clear one field's error as soon as the user acts on it, so a fixed field stops shouting. */
  const clearError = (field: keyof FormErrors) =>
    setErrors((prev) => (prev[field] === undefined ? prev : { ...prev, [field]: undefined }))

  /**
   * The dropzone feeds the form. Everything an extraction produces lands in the
   * same fields the user would have typed, so there is still one submit.
   */
  const handleExtracted = (draft: DraftSchedule, fileName: string) => {
    const replacedInput =
      title.trim().length > 0 || frequency.length > 0 || tasks.some((t) => t.description.trim().length > 0)

    setTitle(draft.title)
    setDetectedFrequency(draft.detectedFrequency)

    // `suggestedFrequency` is the enum value; `detectedFrequency` is free text
    // and would not match any option, so it only ever becomes a hint.
    if (draft.suggestedFrequency && FREQUENCY_VALUES.has(draft.suggestedFrequency)) {
      setFrequency(draft.suggestedFrequency)
    }

    const mapped = draft.tasks.map((t) => ({
      key: nextKey(),
      description: t.description,
      additionalNotes: t.additionalNotes ?? '',
      frequency: t.frequency ?? null,
    }))
    setTasks(mapped.length > 0 ? mapped : [newTask()])

    setErrors({})
    setPrefill({ fileName, taskCount: mapped.length, replacedInput })
  }

  const updateTask = (index: number, patch: Partial<DraftTask>) => {
    clearError('tasks')
    setTasks((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)))
  }

  const addTask = () => {
    setTasks((prev) => {
      focusTaskIndex.current = prev.length
      return [...prev, newTask()]
    })
  }

  const removeTask = (index: number) => {
    setTasks((prev) => {
      if (prev.length === 1) return [newTask()]
      focusTaskIndex.current = Math.max(0, index - 1)
      return prev.filter((_, i) => i !== index)
    })
  }

  const moveTask = (index: number, delta: number) => {
    setTasks((prev) => {
      const target = index + delta
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      focusTaskIndex.current = target
      return next
    })
  }

  const toggleSite = (id: string) => {
    clearError('sites')
    setSelectedSiteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSaving) return

    const cleanTitle = title.trim()
    const cleanTasks = tasks
      .map((t) => ({
        description: t.description.trim(),
        additionalNotes: t.additionalNotes.trim() || null,
        frequency: t.frequency ?? null,
      }))
      .filter((t) => t.description.length > 0)

    const nextErrors: FormErrors = {}
    if (!cleanTitle) nextErrors.title = 'Give the schedule a title.'
    if (!frequency) nextErrors.frequency = 'Choose how often this schedule runs.'
    if (cleanTasks.length === 0) nextErrors.tasks = 'Add at least one task with a description.'
    if (canPickSite && selectedSiteIds.length === 0) nextErrors.sites = 'Select at least one site.'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setIsSaving(true)
    try {
      const res = await apiRequest('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          detectedFrequency,
          suggestedFrequency: frequency,
          tasks: cleanTasks,
          siteIds: selectedSiteIds,
        }),
      })
      if (!res.ok) {
        throw new Error(res.status === 403 ? 'Only admins can create schedules.' : 'Failed to create schedule.')
      }
      toast.success(`Schedule created with ${cleanTasks.length} task${cleanTasks.length === 1 ? '' : 's'}.`)
      closeAndRefresh()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create schedule.')
      setIsSaving(false)
    }
  }

  const labelStyle = { color: tc.textSecondary }
  const inputStyle = { background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }
  const inputClass =
    'w-full px-3 py-2 rounded-lg text-[14px] outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50'
  const sectionLabelClass = 'text-[11px] font-semibold uppercase tracking-[0.06em]'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.97]"
            style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: `1px solid ${tc.btnPrimaryBorder}` }}
          >
            <Plus className="w-4 h-4" />
            New schedule
          </button>
        )}
      </DialogTrigger>

      <DialogContent
        className="max-w-3xl w-[calc(100vw-1.5rem)] sm:w-full max-h-[88svh] p-0 gap-0 flex flex-col overflow-hidden"
        style={{ background: tc.modalBg, borderColor: tc.cardBorder }}
      >
        <DialogHeader className="shrink-0 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 pr-12">
          <DialogTitle style={{ color: tc.textPrimary }}>Create new schedule</DialogTitle>
          <DialogDescription className="text-[13px]" style={{ color: tc.textMuted }}>
            Drop in a document to fill the form automatically, or just type the details in yourself.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1" noValidate>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 pb-5 space-y-5">
            {/* Import: feeds the form below, never saves on its own */}
            <section aria-labelledby={`${fieldId}-import-heading`}>
              <h3 id={`${fieldId}-import-heading`} className={`${sectionLabelClass} mb-2`} style={{ color: tc.textFaint }}>
                Start from a document <span className="font-normal normal-case tracking-normal">(optional)</span>
              </h3>
              <ScheduleDropzone onExtracted={handleExtracted} disabled={isSaving} />
            </section>

            {prefill && (
              <motion.p
                {...fadeUp}
                transition={transitionFast}
                role="status"
                aria-live="polite"
                className="flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] leading-relaxed"
                style={{ background: tc.chipBg(true), color: tc.textSecondary }}
              >
                <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: tc.accentGreen }} />
                <span>
                  Filled in from <span style={{ color: tc.textPrimary }}>{prefill.fileName}</span> -{' '}
                  {prefill.taskCount} task{prefill.taskCount === 1 ? '' : 's'} added
                  {prefill.replacedInput ? ', replacing what you had typed' : ''}. Review and adjust below.
                </span>
              </motion.p>
            )}

            <div className="h-px" style={{ background: tc.divider }} aria-hidden="true" />

            <section aria-labelledby={`${fieldId}-details-heading`} className="space-y-5">
              <h3 id={`${fieldId}-details-heading`} className={sectionLabelClass} style={{ color: tc.textFaint }}>
                Schedule details
              </h3>

              {/* Title */}
              <div>
                <label htmlFor={`${fieldId}-title`} className="block text-[12px] font-medium mb-1.5" style={labelStyle}>
                  Schedule title
                </label>
                <input
                  id={`${fieldId}-title`}
                  value={title}
                  onChange={(e) => {
                    clearError('title')
                    setTitle(e.target.value)
                  }}
                  disabled={isSaving}
                  placeholder="e.g. Weekly Kitchen Deep Clean"
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? `${fieldId}-title-error` : undefined}
                  className={inputClass}
                  style={{ ...inputStyle, borderColor: errors.title ? tc.statusOverdue.text : tc.inputBorder }}
                />
                <FieldError id={`${fieldId}-title-error`} message={errors.title} color={tc.statusOverdue.text} />
              </div>

              {/* Frequency */}
              <div>
                <label
                  htmlFor={`${fieldId}-frequency`}
                  className="block text-[12px] font-medium mb-1.5"
                  style={labelStyle}
                >
                  Frequency
                </label>
                <select
                  id={`${fieldId}-frequency`}
                  value={frequency}
                  onChange={(e) => {
                    clearError('frequency')
                    setFrequency(e.target.value)
                  }}
                  disabled={isSaving}
                  aria-invalid={!!errors.frequency}
                  aria-describedby={
                    [errors.frequency ? `${fieldId}-frequency-error` : null, detectedFrequency ? `${fieldId}-frequency-hint` : null]
                      .filter(Boolean)
                      .join(' ') || undefined
                  }
                  className={inputClass}
                  style={{ ...inputStyle, borderColor: errors.frequency ? tc.statusOverdue.text : tc.inputBorder }}
                >
                  <option value="">Select a frequency…</option>
                  {FREQUENCY_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
                {detectedFrequency && (
                  <p id={`${fieldId}-frequency-hint`} className="mt-1.5 text-[11px]" style={{ color: tc.textFaint }}>
                    The document says “{detectedFrequency}”.
                  </p>
                )}
                <FieldError id={`${fieldId}-frequency-error`} message={errors.frequency} color={tc.statusOverdue.text} />
              </div>

              {/* Tasks */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-medium" style={labelStyle}>
                    Tasks
                  </span>
                  <span className="text-[11px] tabular-nums" style={{ color: tc.textFaint }}>
                    {tasks.filter((t) => t.description.trim()).length} added
                  </span>
                </div>
                <ul ref={taskListRef} className="space-y-2">
                  {tasks.map((task, i) => (
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
                      <div className="flex flex-col gap-1 shrink-0">
                        <IconAction
                          label={`Move task ${i + 1} up`}
                          onClick={() => moveTask(i, -1)}
                          disabled={isSaving || i === 0}
                          tc={tc}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </IconAction>
                        <IconAction
                          label={`Move task ${i + 1} down`}
                          onClick={() => moveTask(i, 1)}
                          disabled={isSaving || i === tasks.length - 1}
                          tc={tc}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </IconAction>
                        <IconAction
                          label={`Remove task ${i + 1}`}
                          onClick={() => removeTask(i)}
                          disabled={isSaving}
                          tc={tc}
                          danger
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </IconAction>
                      </div>
                    </li>
                  ))}
                </ul>
                <FieldError id={`${fieldId}-tasks-error`} message={errors.tasks} color={tc.statusOverdue.text} />
                <button
                  type="button"
                  onClick={addTask}
                  disabled={isSaving}
                  className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.97] disabled:opacity-50"
                  style={{
                    background: tc.btnSecondaryBg,
                    color: tc.btnSecondaryText,
                    border: `1px solid ${tc.btnSecondaryBorder}`,
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add task
                </button>
              </div>

              {/* Sites - only for roles that span more than one; the server pins the rest. */}
              {canPickSite && (
                <div>
                  <span id={`${fieldId}-sites-label`} className="block text-[12px] font-medium mb-1.5" style={labelStyle}>
                    Sites
                  </span>
                  <div
                    role="group"
                    aria-labelledby={`${fieldId}-sites-label`}
                    aria-describedby={errors.sites ? `${fieldId}-sites-error` : undefined}
                    className="max-h-36 overflow-y-auto rounded-lg p-2 space-y-1"
                    style={{
                      background: tc.inputBg,
                      border: `1px solid ${errors.sites ? tc.statusOverdue.text : tc.inputBorder}`,
                    }}
                  >
                    {sites.length === 0 ? (
                      <p className="text-[12px] px-1 py-0.5" style={{ color: tc.textMuted }}>
                        No sites available.
                      </p>
                    ) : (
                      sites.map((s) => (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 px-1 py-1 cursor-pointer text-[13px]"
                          style={{ color: tc.inputText }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSiteIds.includes(s.id)}
                            onChange={() => toggleSite(s.id)}
                            disabled={isSaving}
                            className="h-3.5 w-3.5 rounded-sm focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                          />
                          {s.name}
                        </label>
                      ))
                    )}
                  </div>
                  <FieldError id={`${fieldId}-sites-error`} message={errors.sites} color={tc.statusOverdue.text} />
                </div>
              )}
            </section>
          </div>

          {/* Single submit for both routes, pinned so it stays reachable on a phone */}
          <div
            className="shrink-0 flex items-center justify-end gap-2 px-5 sm:px-6 py-4"
            style={{ borderTop: `1px solid ${tc.divider}`, background: tc.modalBg }}
          >
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={isSaving}
              className="flex-1 sm:flex-none px-3.5 py-2.5 sm:py-2 rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.97] disabled:opacity-50"
              style={{
                background: tc.btnSecondaryBg,
                color: tc.btnSecondaryText,
                border: `1px solid ${tc.btnSecondaryBorder}`,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.97] disabled:opacity-60"
              style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: `1px solid ${tc.btnPrimaryBorder}` }}
            >
              {isSaving && <Spinner />}
              {isSaving ? 'Creating…' : 'Create schedule'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function FieldError({ id, message, color }: { id: string; message?: string; color: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1.5 text-[12px]" style={{ color }}>
      {message}
    </p>
  )
}

function IconAction({
  label,
  onClick,
  disabled,
  danger,
  tc,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  tc: ReturnType<typeof useThemeColors>
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex items-center justify-center w-7 h-7 rounded-md transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.94] disabled:opacity-35 disabled:cursor-not-allowed"
      style={{
        background: danger ? tc.btnDangerBg : tc.btnSecondaryBg,
        color: danger ? tc.btnDangerText : tc.btnSecondaryText,
        border: `1px solid ${danger ? tc.btnDangerBorder : tc.btnSecondaryBorder}`,
      }}
    >
      {children}
    </button>
  )
}
