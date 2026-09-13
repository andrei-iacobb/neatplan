'use client'

import { useState } from 'react'
import { QrCode, RefreshCw } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { hasMinRole } from '@/lib/roles'
import { apiRequest } from '@/lib/url-utils'
import { useToast } from '@/components/ui/toast-context'

interface LabelActionsProps {
  kind: 'room' | 'equipment'
  /** One target. Omit to link to the whole filtered sheet. */
  id?: string
  /** Shown in the confirmation, so the consequence names the thing. */
  name?: string
  /** Carried into the label sheet link. */
  site?: string | null
  floor?: string | null
  /** Compact form for a modal footer. */
  size?: 'default' | 'sm'
  className?: string
}

/**
 * Print and replace the physical labels for a location.
 *
 * Replacing is destructive in the real world rather than in the database: it
 * invalidates every sticker already on a wall, so the confirmation says exactly
 * that instead of asking whether the user is sure.
 */
export function LabelActions({
  kind,
  id,
  name,
  site,
  floor,
  size = 'default',
  className,
}: LabelActionsProps) {
  const { data: session } = useSession()
  const { showToast } = useToast()
  const [isRevoking, setIsRevoking] = useState(false)

  const role = (session?.user as { role?: string } | undefined)?.role
  if (!hasMinRole(role, 'HEAD_OF_HOUSEKEEPING')) return null

  const query = new URLSearchParams({ kind })
  if (id) query.set('ids', id)
  if (site && site !== 'ALL' && site !== 'all') query.set('site', site)
  if (floor && !id) query.set('floor', floor)

  async function handleRevoke() {
    if (!id) return

    const target = name ? `"${name}"` : 'this location'
    const confirmed = window.confirm(
      `Replace the label for ${target}?\n\nEvery QR code and NFC tag already printed for it stops working immediately, and anyone scanning the old sticker is told to ask for a new one. This cannot be undone - you will need to print and put up a replacement.`
    )
    if (!confirmed) return

    setIsRevoking(true)
    try {
      const response = await apiRequest('/api/labels/revoke', {
        method: 'POST',
        body: JSON.stringify({ kind, ids: [id] }),
      })

      if (!response.ok) throw new Error('revoke failed')
      const result = await response.json()

      if (result.revoked === 0) {
        showToast('That location could not be relabelled', 'error')
      } else {
        showToast('Old labels revoked. Print a replacement.', 'success')
      }
    } catch {
      showToast('Could not replace the label. Check the connection and try again.', 'error')
    } finally {
      setIsRevoking(false)
    }
  }

  const base =
    'inline-flex items-center gap-2 rounded-lg border border-[rgb(var(--control-border))] bg-[rgb(var(--surface))] font-medium text-[rgb(var(--text-secondary))] transition-colors hover:bg-[rgb(var(--surface-raised))] hover:text-[rgb(var(--text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--primary))] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--card))] active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none motion-reduce:transition-none motion-reduce:active:scale-100'
  const sizing = size === 'sm' ? 'h-10 px-3 text-xs' : 'min-h-[44px] px-4 text-sm'

  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`} data-print-hide>
      <a
        className={`${base} ${sizing}`}
        href={`/print/labels?${query.toString()}`}
        target="_blank"
        rel="noopener noreferrer"
        title={id ? 'Print a label for this location' : 'Print labels for everything in this list'}
      >
        <QrCode size={16} aria-hidden="true" />
        {id ? 'Label' : 'Labels'}
      </a>

      {id ? (
        <button
          type="button"
          className={`${base} ${sizing}`}
          onClick={handleRevoke}
          disabled={isRevoking}
          title="Invalidate the labels already printed for this location"
        >
          <RefreshCw size={16} aria-hidden="true" className={isRevoking ? 'animate-spin' : undefined} />
          {isRevoking ? 'Replacing...' : 'Replace label'}
        </button>
      ) : null}
    </div>
  )
}
