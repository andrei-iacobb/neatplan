'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, UploadCloud, Sparkles, Trash2, Plus, FileText } from 'lucide-react'
import { useThemeColors } from '@/hooks/useThemeColors'
import { apiRequest } from '@/lib/url-utils'

interface DraftTask {
  description: string
  frequency: string | null
  additionalNotes: string | null
}

interface DraftSchedule {
  title: string
  detectedFrequency: string | null
  area: string | null
  tasks: DraftTask[]
}

interface ScheduleImportProps {
  /** Called after a schedule is successfully saved so the parent can refresh. */
  onSaved: () => void
}

const FREQUENCY_SUGGESTIONS = [
  'Daily',
  'Weekly',
  'Fortnightly',
  'Monthly',
  'Quarterly',
  'Annually',
  'After vacancy',
  'As required',
]

type Mode = 'idle' | 'loading' | 'preview' | 'saving'

async function safeJson(res: Response): Promise<any> {
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

export function ScheduleImport({ onSaved }: ScheduleImportProps) {
  const tc = useThemeColors()
  const inputRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)
  const [mode, setMode] = useState<Mode>('idle')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftSchedule | null>(null)

  const extract = async (file: File) => {
    if (busyRef.current) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('That file is over 10MB. Please upload a smaller file.')
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    busyRef.current = true
    setFileName(file.name)
    setMode('loading')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiRequest('/api/ai/schedule/extract', { method: 'POST', body: formData })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data?.error || 'Could not read that document.')
      if (!data || !Array.isArray(data.tasks) || data.tasks.length === 0) {
        throw new Error('No cleaning tasks were found in that document.')
      }
      setDraft({
        title: data.title || 'Cleaning Schedule',
        detectedFrequency: data.detectedFrequency ?? null,
        area: data.area ?? null,
        tasks: data.tasks.map((t: any) => ({
          description: String(t.description ?? ''),
          frequency: t.frequency ?? null,
          additionalNotes: t.additionalNotes ?? null,
        })),
      })
      setMode('preview')
      toast.success(`Found ${data.tasks.length} task${data.tasks.length === 1 ? '' : 's'} — review and save.`)
    } catch (err: any) {
      setMode('idle')
      setFileName(null)
      toast.error(err.message || 'Failed to read the document.')
    } finally {
      busyRef.current = false
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) extract(file)
  }

  const updateTask = (i: number, patch: Partial<DraftTask>) => {
    setDraft((prev) =>
      prev ? { ...prev, tasks: prev.tasks.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) } : prev,
    )
  }

  const removeTask = (i: number) => {
    setDraft((prev) => (prev ? { ...prev, tasks: prev.tasks.filter((_, idx) => idx !== i) } : prev))
  }

  const addTask = () => {
    setDraft((prev) =>
      prev ? { ...prev, tasks: [...prev.tasks, { description: '', frequency: null, additionalNotes: null }] } : prev,
    )
  }

  const reset = () => {
    setDraft(null)
    setFileName(null)
    setMode('idle')
  }

  const save = async () => {
    if (!draft || busyRef.current) return
    const cleanTitle = draft.title.trim()
    const tasks = draft.tasks
      .map((t) => ({
        description: t.description.trim(),
        frequency: t.frequency?.trim() || null,
        additionalNotes: t.additionalNotes?.trim() || null,
      }))
      .filter((t) => t.description.length > 0)
    if (!cleanTitle) {
      toast.error('Give the schedule a title before saving.')
      return
    }
    if (tasks.length === 0) {
      toast.error('Add at least one task before saving.')
      return
    }
    busyRef.current = true
    setMode('saving')
    try {
      const res = await apiRequest('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: cleanTitle, tasks }),
      })
      const data = await safeJson(res)
      if (!res.ok) {
        throw new Error(
          res.status === 403 ? 'Only admins can create schedules.' : data?.error || 'Failed to save schedule.',
        )
      }
      toast.success('Schedule saved.')
      reset()
      onSaved()
    } catch (err: any) {
      setMode('preview')
      toast.error(err.message || 'Failed to save schedule.')
    } finally {
      busyRef.current = false
    }
  }

  // ---- Preview (editable) ----
  if (mode === 'preview' || mode === 'saving') {
    const saving = mode === 'saving'
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 shrink-0" style={{ color: tc.accentGreen }} />
            <p className="text-[13px] truncate" style={{ color: tc.textMuted }}>
              Extracted from <span style={{ color: tc.textSecondary }}>{fileName}</span> — edit anything before saving.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="schedule-import-title" className="block text-[12px] font-medium mb-1.5" style={{ color: tc.textSecondary }}>
            Schedule title
          </label>
          <input
            id="schedule-import-title"
            value={draft?.title ?? ''}
            onChange={(e) => setDraft((p) => (p ? { ...p, title: e.target.value } : p))}
            className="w-full px-3 py-2 rounded-lg text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
            placeholder="e.g. Bedroom Deep Clean"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium" style={{ color: tc.textSecondary }}>
              Tasks ({draft?.tasks.length ?? 0})
            </label>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {draft?.tasks.map((task, i) => (
              <div
                key={i}
                className="rounded-lg p-3 flex flex-col sm:flex-row gap-2"
                style={{ background: tc.surfaceBg, border: `1px solid ${tc.divider}` }}
              >
                <input
                  value={task.description}
                  onChange={(e) => updateTask(i, { description: e.target.value })}
                  className="flex-1 px-2.5 py-1.5 rounded-md text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                  placeholder="Task description"
                  aria-label={`Task ${i + 1} description`}
                />
                <input
                  value={task.frequency ?? ''}
                  onChange={(e) => updateTask(i, { frequency: e.target.value })}
                  list="neatplan-frequency-suggestions"
                  className="w-full sm:w-[150px] px-2.5 py-1.5 rounded-md text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                  placeholder="Frequency"
                  aria-label={`Task ${i + 1} frequency`}
                />
                <button
                  onClick={() => removeTask(i)}
                  className="shrink-0 flex items-center justify-center w-8 h-8 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 active:scale-[0.94]"
                  style={{ background: tc.btnDangerBg, color: tc.btnDangerText, border: `1px solid ${tc.btnDangerBorder}` }}
                  aria-label={`Remove task ${i + 1}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <datalist id="neatplan-frequency-suggestions">
            {FREQUENCY_SUGGESTIONS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <button
            onClick={addTask}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.97]"
            style={{ background: tc.btnSecondaryBg, color: tc.btnSecondaryText, border: `1px solid ${tc.btnSecondaryBorder}` }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add task
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={reset}
            disabled={saving}
            className="px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.97] disabled:opacity-50"
            style={{ background: tc.btnSecondaryBg, color: tc.btnSecondaryText, border: `1px solid ${tc.btnSecondaryBorder}` }}
          >
            Discard
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.97] disabled:opacity-60"
            style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: `1px solid ${tc.btnPrimaryBorder}` }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save schedule'}
          </button>
        </div>
      </div>
    )
  }

  // ---- Idle / loading dropzone ----
  const loading = mode === 'loading'
  return (
    <div className="space-y-3">
      <p className="text-[13px]" style={{ color: tc.textMuted }}>
        Upload a photo, scan, or PDF of any cleaning schedule. It reads the layout and builds an editable schedule for
        you — no fixed format required.
      </p>
      <button
        type="button"
        onClick={() => !loading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!loading) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        disabled={loading}
        className="w-full rounded-xl px-6 py-10 flex flex-col items-center justify-center gap-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-wait"
        style={{
          background: dragging ? tc.dropzoneActiveBg : tc.dropzoneBg,
          border: `1.5px dashed ${dragging ? tc.dropzoneActiveBorder : tc.dropzoneBorder}`,
        }}
      >
        {loading ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: tc.accentGreen }} />
            <p className="text-[14px] font-medium" style={{ color: tc.textSecondary }}>
              Reading {fileName}…
            </p>
            <p className="text-[12px]" style={{ color: tc.textFaint }}>
              This can take a few seconds
            </p>
          </>
        ) : (
          <>
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center mb-1"
              style={{ background: tc.chipBg(true) }}
            >
              <UploadCloud className="w-5 h-5" style={{ color: tc.accentGreen }} />
            </div>
            <p className="text-[14px] font-medium" style={{ color: tc.textSecondary }}>
              Drop a schedule here, or click to browse
            </p>
            <p className="text-[12px] flex items-center gap-1" style={{ color: tc.textFaint }}>
              <FileText className="w-3 h-3" /> JPG, PNG, PDF or DOCX · up to 10MB
            </p>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) extract(file)
        }}
      />
    </div>
  )
}
