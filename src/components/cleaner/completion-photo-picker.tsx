'use client'

import Image from 'next/image'
import { useEffect, useId, useRef, useState } from 'react'
import { useThemeColors } from '@/hooks/useThemeColors'
import { apiRequest } from '@/lib/url-utils'

interface PhotoDraft {
  files: File[]
  caption: string
}

interface PendingPhotos extends PhotoDraft {
  completionIds: string[]
  batchId: string
}

const EMPTY_DRAFT: PhotoDraft = { files: [], caption: '' }
const MAX_FILE_BYTES = 12 * 1024 * 1024

function PhotoPreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const nextUrl = URL.createObjectURL(file)
    setUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [file])
  return url ? <Image src={url} alt={`Selected photo: ${file.name}`} width={128} height={96} unoptimized className="h-24 w-32 rounded-sm object-cover" /> : null
}

export function CompletionPhotoPicker({ value = EMPTY_DRAFT, onChange, disabled = false }: {
  value?: PhotoDraft
  onChange: (value: PhotoDraft) => void
  disabled?: boolean
}) {
  const tc = useThemeColors()
  const id = useId()
  const [error, setError] = useState<string | null>(null)

  function addFiles(selected: FileList | null) {
    if (!selected?.length) return
    const files = [...value.files, ...Array.from(selected)]
    if (files.length > 3) {
      setError('Choose up to 3 photos. Remove a photo before adding another.')
      return
    }
    if (files.some(file => file.size > MAX_FILE_BYTES || file.size === 0 || !/^image\/(jpeg|png|webp)$/.test(file.type))) {
      setError('Use JPEG, PNG or WebP photos, up to 12 MB each.')
      return
    }
    setError(null)
    onChange({ ...value, files })
  }

  const inputStyle = { color: tc.inputText, background: tc.inputBg, borderColor: tc.inputBorder }
  return (
    <fieldset disabled={disabled} className="my-4 space-y-3 min-w-0">
      <legend className="text-sm font-medium" style={{ color: tc.textSecondary }}>Completion photos (optional)</legend>
      <p id={`${id}-help`} className="text-sm" style={{ color: tc.textMuted }}>
        Photograph cleaned surfaces or equipment only. Keep people and resident details out of shot.
      </p>
      {!disabled && <div className="space-y-2">
        <label htmlFor={`${id}-files`} className="block text-sm" style={{ color: tc.textSecondary }}>Choose photos (up to 3, 12 MB each)</label>
        <input id={`${id}-files`} type="file" accept="image/jpeg,image/png,image/webp" multiple aria-describedby={`${id}-help`} className="block w-full min-h-12 text-sm file:min-h-12 file:mr-3 file:px-3 file:rounded-sm file:border-0 focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: tc.textSecondary }} onChange={event => { addFiles(event.currentTarget.files); event.currentTarget.value = '' }} />
        <label htmlFor={`${id}-camera`} className="block text-sm" style={{ color: tc.textSecondary }}>Take a photo</label>
        <input id={`${id}-camera`} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-describedby={`${id}-help`} className="block w-full min-h-12 text-sm file:min-h-12 file:mr-3 file:px-3 file:rounded-sm file:border-0 focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: tc.textSecondary }} onChange={event => { addFiles(event.currentTarget.files); event.currentTarget.value = '' }} />
      </div>}
      {error && <p role="alert" className="text-sm" style={{ color: tc.statusOverdue.text }}>{error}</p>}
      {value.files.length > 0 && <>
        <ul className="flex flex-wrap gap-3">
          {value.files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="w-32">
            <PhotoPreview file={file} />
            {!disabled && <button type="button" aria-label={`Remove photo ${index + 1}: ${file.name}`} className="min-h-12 w-full rounded-sm text-sm underline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: tc.textSecondary }} onClick={() => { setError(null); onChange({ ...value, files: value.files.filter((_, position) => position !== index) }) }}>Remove photo {index + 1}</button>}
          </li>)}
        </ul>
        <label htmlFor={`${id}-caption`} className="block text-sm" style={{ color: tc.textSecondary }}>Photo caption (optional)</label>
        <input id={`${id}-caption`} value={value.caption} maxLength={240} onChange={event => onChange({ ...value, caption: event.target.value })} className="w-full min-h-12 rounded-sm border px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2" style={inputStyle} />
      </>}
    </fieldset>
  )
}

// A saved sign-off must never be submitted again just because its photo upload failed.
export function useCompletionPhotos(kind: 'room' | 'equipment') {
  const [drafts, setDrafts] = useState<Record<string, PhotoDraft>>({})
  const [pending, setPending] = useState<PendingPhotos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const busy = useRef(false)

  async function upload(batch: PendingPhotos): Promise<boolean> {
    if (busy.current) return false
    busy.current = true
    setUploading(true)
    setError(null)
    try {
      if (!batch.completionIds.length) throw new Error('The saved cleaning record could not be read. Your cleaning is saved; ask your manager about adding the photos.')
      const form = new FormData()
      form.set('kind', kind)
      form.set('completionIds', JSON.stringify(batch.completionIds))
      form.set('batchId', batch.batchId)
      form.set('caption', batch.caption)
      batch.files.forEach(file => form.append('files', file))
      const response = await apiRequest('/api/completion-photos', { method: 'POST', body: form, signal: AbortSignal.timeout(60_000) })
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null)
        throw new Error(body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'Check your connection and retry the photo upload.')
      }
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Check your connection and retry the photo upload.')
      return false
    } finally {
      busy.current = false
      setUploading(false)
    }
  }

  async function attach(scheduleId: string, completionResponse: Response): Promise<boolean> {
    const draft = drafts[scheduleId]
    if (!draft?.files.length) return true
    const batch: PendingPhotos = { ...draft, completionIds: [], batchId: crypto.randomUUID() }
    setPending(batch)
    const result: unknown = await completionResponse.json().catch(() => null)
    if (result && typeof result === 'object') {
      if ('completionIds' in result && Array.isArray(result.completionIds) && result.completionIds.every((id: unknown) => typeof id === 'string')) {
        batch.completionIds = result.completionIds
      } else if ('completionId' in result && typeof result.completionId === 'string') {
        batch.completionIds = [result.completionId]
      }
    }
    setPending({ ...batch })
    return upload(batch)
  }

  return { drafts, pending, error, uploading, attach,
    setDraft: (scheduleId: string, draft: PhotoDraft) => setDrafts(previous => ({ ...previous, [scheduleId]: draft })),
    retry: () => pending ? upload(pending) : Promise.resolve(false),
  }
}

export function CompletionPhotoRecovery({ photos, onContinue }: {
  photos: ReturnType<typeof useCompletionPhotos>
  onContinue: () => void
}) {
  const tc = useThemeColors()
  if (!photos.pending) return null
  return <section className="max-w-xl mx-auto px-4 py-8" aria-labelledby="photo-upload-heading">
    <h1 id="photo-upload-heading" className="text-xl font-semibold" style={{ color: tc.textPrimary }}>Cleaning saved</h1>
    <p role={photos.error ? 'alert' : 'status'} className="mt-3 text-sm" style={{ color: photos.error ? tc.statusOverdue.text : tc.textSecondary }}>
      {photos.error ? 'Cleaning saved. Photos were not uploaded.' : 'Uploading your photos...'}
    </p>
    {photos.error && <p className="mt-2 text-sm" style={{ color: tc.textSecondary }}>{photos.error}</p>}
    <CompletionPhotoPicker value={photos.pending} onChange={() => {}} disabled />
    {photos.error && <div className="flex flex-wrap gap-3">
      {photos.pending.completionIds.length > 0 && <button type="button" className="min-h-12 rounded-sm px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2" style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText }} onClick={async () => { if (await photos.retry()) onContinue() }}>Retry photo upload</button>}
      <button type="button" className="min-h-12 rounded-sm border px-4 focus-visible:outline-2 focus-visible:outline-offset-2" style={{ borderColor: tc.btnSecondaryBorder, color: tc.textSecondary }} onClick={onContinue}>Continue without photos</button>
    </div>}
  </section>
}
