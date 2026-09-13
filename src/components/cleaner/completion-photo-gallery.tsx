'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useThemeColors } from '@/hooks/useThemeColors'

export interface CompletionPhoto {
  id: string
  imageUrl: string
  caption: string | null
  createdAt: string
}

function Photo({ photo, itemName }: { photo: CompletionPhoto; itemName: string }) {
  const [failed, setFailed] = useState(false)
  const tc = useThemeColors()
  // Keep private images on the authenticated endpoint, including the full-size link.
  const url = `/api/completion-photos/${encodeURIComponent(photo.id)}`
  return <figure className="w-48 max-w-full">
    {failed ? <p className="rounded-sm border p-3 text-sm" style={{ color: tc.textMuted, borderColor: tc.cardBorder }}>Photo unavailable.</p> : <a href={url} target="_blank" rel="noopener noreferrer" className="block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`Open completion photo of ${itemName} in a new tab`}>
      <Image src={url} alt={photo.caption || `Completion photo of ${itemName}`} width={192} height={144} unoptimized className="h-36 w-48 rounded-sm object-cover" onError={() => setFailed(true)} />
    </a>}
    <figcaption className="mt-2 space-y-1 break-words text-sm" style={{ color: tc.textSecondary }}>
      {photo.caption && <p>{photo.caption}</p>}
      <time dateTime={photo.createdAt} className="block text-xs tabular-nums" style={{ color: tc.textMuted }}>{new Date(photo.createdAt).toLocaleString('en-GB')}</time>
    </figcaption>
  </figure>
}

export function CompletionPhotoGallery({ photos, itemName }: { photos: CompletionPhoto[]; itemName: string }) {
  const tc = useThemeColors()
  return <div className="mt-4 border-t pt-3" style={{ borderColor: tc.tableDivider }}>
    <h3 className="mb-3 text-sm font-semibold" style={{ color: tc.textSecondary }}>Completion photos</h3>
    {photos.length ? <div className="flex flex-wrap gap-4">{photos.map(photo => <Photo key={photo.id} photo={photo} itemName={itemName} />)}</div> : <p className="text-sm" style={{ color: tc.textMuted }}>No photos attached.</p>}
  </div>
}
