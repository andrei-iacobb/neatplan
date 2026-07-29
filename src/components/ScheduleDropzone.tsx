'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { UploadCloud, FileText } from 'lucide-react'
import { Spinner } from '@/components/ui/loading'
import { useThemeColors } from '@/hooks/useThemeColors'
import { apiRequest } from '@/lib/url-utils'

export interface ExtractedTask {
  description: string
  frequency: string | null
  additionalNotes: string | null
}

export interface DraftSchedule {
  title: string
  /** Free text as written in the document, e.g. "every morning". Not an enum value. */
  detectedFrequency: string | null
  /** A ScheduleFrequency enum value, or null when the model could not map one. */
  suggestedFrequency: string | null
  area: string | null
  tasks: ExtractedTask[]
}

interface ScheduleDropzoneProps {
  /**
   * Called with the extracted draft. The dropzone never persists anything -
   * the parent form owns the fields, the site picker and the single submit.
   */
  onExtracted: (draft: DraftSchedule, fileName: string) => void
  disabled?: boolean
}

const MAX_FILE_BYTES = 10 * 1024 * 1024

async function safeJson(res: Response): Promise<any> {
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) return null
  try {
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Drag-and-drop (or click-to-browse) document extraction.
 *
 * This is the extraction half only: it reads a document and hands the draft
 * back up. Rendering and saving the draft is the caller's job, so there is
 * exactly one form and one submit button in the dialog.
 */
export function ScheduleDropzone({ onExtracted, disabled = false }: ScheduleDropzoneProps) {
  const tc = useThemeColors()
  const inputRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const clearInput = () => {
    if (inputRef.current) inputRef.current.value = ''
  }

  const extract = async (file: File) => {
    if (busyRef.current || disabled) return
    if (file.size > MAX_FILE_BYTES) {
      toast.error('That file is over 10MB. Please upload a smaller file.')
      clearInput()
      return
    }
    busyRef.current = true
    setFileName(file.name)
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiRequest('/api/ai/schedule/extract', { method: 'POST', body: formData })
      const data = await safeJson(res)
      if (!res.ok) throw new Error(data?.error || 'Could not read that document.')
      if (!data || !Array.isArray(data.tasks) || data.tasks.length === 0) {
        throw new Error('No cleaning tasks were found in that document.')
      }
      onExtracted(
        {
          title: data.title || 'Cleaning Schedule',
          detectedFrequency: data.detectedFrequency ?? null,
          suggestedFrequency: data.suggestedFrequency ?? null,
          area: data.area ?? null,
          tasks: data.tasks.map((t: any) => ({
            description: String(t.description ?? ''),
            frequency: t.frequency ?? null,
            additionalNotes: t.additionalNotes ?? null,
          })),
        },
        file.name,
      )
      toast.success(
        `Found ${data.tasks.length} task${data.tasks.length === 1 ? '' : 's'} - the fields below are filled in.`,
      )
    } catch (err: any) {
      setFileName(null)
      toast.error(err.message || 'Failed to read the document.')
    } finally {
      busyRef.current = false
      setLoading(false)
      clearInput()
    }
  }

  const busy = loading || disabled

  return (
    <div>
      <button
        type="button"
        onClick={() => !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!busy) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (busy) return
          const file = e.dataTransfer.files?.[0]
          if (file) extract(file)
        }}
        disabled={busy}
        aria-describedby="schedule-dropzone-hint"
        className="w-full rounded-xl px-6 py-8 sm:py-10 flex flex-col items-center justify-center gap-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-wait disabled:opacity-60"
        style={{
          background: dragging ? tc.dropzoneActiveBg : tc.dropzoneBg,
          border: `1.5px dashed ${dragging ? tc.dropzoneActiveBorder : tc.dropzoneBorder}`,
        }}
      >
        {loading ? (
          <>
            <Spinner size="md" color={tc.accentGreen} />
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
      <p id="schedule-dropzone-hint" className="mt-1.5 text-[11px]" style={{ color: tc.textFaint }}>
        The document is read into the fields below. Nothing is saved until you press Create schedule.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) extract(file)
        }}
      />
    </div>
  )
}
