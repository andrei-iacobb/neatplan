'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { apiRequest } from '@/lib/url-utils'
import { useToast } from '@/components/ui/toast-context'

interface EquipmentPhoto {
  id: string
  url: string
  caption: string | null
  width: number
  height: number
  byteSize: number
  createdAt: string
  uploadedBy?: { name: string | null } | null
}

interface EquipmentPhotosProps {
  equipmentId: string
  equipmentName: string
}

/**
 * Identification photos for one piece of equipment.
 *
 * Entirely optional. Nothing here gates anything: an item with no photos behaves
 * exactly as it always has, and the cleaning flow never asks for one. These exist
 * so a manager can tell four identical hoists apart, and so a cleaner opening a
 * task list can see which machine is meant.
 *
 * Tablet-first. The primary control opens the camera directly rather than a file
 * browser, because the person adding one is standing in front of the thing.
 */
export function EquipmentPhotos({ equipmentId, equipmentName }: EquipmentPhotosProps) {
  const { showToast } = useToast()
  const [photos, setPhotos] = useState<EquipmentPhoto[] | null>(null)
  const [limit, setLimit] = useState(4)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const response = await apiRequest(`/api/admin/equipment/${equipmentId}/photos`)
      if (!response.ok) throw new Error('load failed')
      const data = await response.json()
      setPhotos(data.photos)
      setLimit(data.limit)
    } catch {
      setLoadError('Could not load the photos for this item.')
      setPhotos([])
    }
  }, [equipmentId])

  useEffect(() => {
    void load()
  }, [load])

  async function upload(file: File) {
    setIsUploading(true)
    try {
      const body = new FormData()
      body.append('photo', file)

      const response = await apiRequest(`/api/admin/equipment/${equipmentId}/photos`, {
        method: 'POST',
        body,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        // The server writes these for the person holding the tablet, so show
        // them as they are rather than replacing them with something generic.
        showToast(data?.error ?? 'That photo could not be saved.', 'error')
        return
      }

      await load()
      showToast('Photo added', 'success')
    } catch {
      showToast('Could not save the photo. Check the connection and try again.', 'error')
    } finally {
      setIsUploading(false)
      // Clearing the inputs means retaking the same photo fires a change event.
      if (cameraInput.current) cameraInput.current.value = ''
      if (libraryInput.current) libraryInput.current.value = ''
    }
  }

  async function remove(photo: EquipmentPhoto) {
    const confirmed = window.confirm(
      `Delete this photo of "${equipmentName}"?\n\nIt is removed from the item and from the server. Nothing else about the item or its cleaning record changes.`
    )
    if (!confirmed) return

    setDeletingId(photo.id)
    try {
      const response = await apiRequest(
        `/api/admin/equipment/${equipmentId}/photos/${photo.id}`,
        { method: 'DELETE' }
      )
      if (!response.ok) throw new Error('delete failed')

      setPhotos((current) => (current ?? []).filter((item) => item.id !== photo.id))
      showToast('Photo deleted', 'success')
    } catch {
      showToast('Could not delete the photo. Try again.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const atLimit = (photos?.length ?? 0) >= limit
  const controlClass =
    'flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none motion-reduce:active:scale-100'
  const controlStyle = {
    background: 'rgb(var(--surface-raised))',
    color: 'rgb(var(--text-primary))',
    border: '1px solid rgb(var(--control-border) / 0.5)',
  }

  return (
    <div>
      <p className="text-[11px]" style={{ color: 'rgb(var(--text-muted))' }}>
        Optional. Photos help tell identical items apart - they are not a record of any clean.
      </p>

      {loadError ? (
        <div
          className="mt-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-[12px]"
          style={{ background: 'rgb(var(--destructive) / 0.08)', color: 'rgb(var(--destructive))' }}
        >
          <span>{loadError}</span>
          <button type="button" onClick={() => void load()} className="font-semibold underline">
            Retry
          </button>
        </div>
      ) : null}

      {photos === null ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {/* Shape-matched so nothing shifts when the real photos arrive. */}
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="aspect-square animate-pulse rounded-lg"
              style={{ background: 'rgb(var(--surface-raised))' }}
            />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <p className="mt-3 text-[12px]" style={{ color: 'rgb(var(--text-muted))' }}>
          No photos yet.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-lg"
              style={{ border: '1px solid rgb(var(--border) / var(--border-alpha))' }}
            >
              <Image
                src={photo.url}
                alt={photo.caption ?? `Photo of ${equipmentName}`}
                fill
                sizes="(max-width: 640px) 50vw, 160px"
                className="object-cover"
                // Served from an authorised route, so no optimisation proxy.
                unoptimized
              />
              <button
                type="button"
                onClick={() => void remove(photo)}
                disabled={deletingId === photo.id}
                aria-label={`Delete photo of ${equipmentName}`}
                // Always visible rather than hover-only: on a tablet there is no
                // hover, and a control you cannot reveal is a control you do not have.
                className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-lg backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
                style={{ background: 'rgb(0 0 0 / 0.55)', color: '#fff' }}
              >
                {deletingId === photo.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex gap-2">
        {/* `capture` asks a tablet for the rear camera directly instead of a file
            browser; a desktop browser ignores it and shows a picker. */}
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
          }}
        />
        <input
          ref={libraryInput}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
          }}
        />

        <button
          type="button"
          className={controlClass}
          style={controlStyle}
          disabled={isUploading || atLimit}
          onClick={() => cameraInput.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Camera className="h-4 w-4" aria-hidden="true" />
          )}
          {isUploading ? 'Saving...' : 'Take photo'}
        </button>

        <button
          type="button"
          className={controlClass}
          style={controlStyle}
          disabled={isUploading || atLimit}
          onClick={() => libraryInput.current?.click()}
        >
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          Choose file
        </button>
      </div>

      {atLimit ? (
        <p className="mt-2 text-[11px]" style={{ color: 'rgb(var(--text-muted))' }}>
          {limit} photos is the limit for one item. Delete one to add another.
        </p>
      ) : null}
    </div>
  )
}
