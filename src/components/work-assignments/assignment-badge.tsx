'use client'

import { useEffect, useState } from 'react'
import { apiRequest } from '@/lib/url-utils'
import type { AssignmentBoard } from '@/lib/work-assignments/policy'

export function AssignmentBadge({
  kind,
  targetId,
}: {
  kind: 'room' | 'equipment'
  targetId: string
}) {
  const [label, setLabel] = useState('Loading allocation...')
  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ kind, targetId })
    apiRequest(`/api/work-assignments?${params}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Allocation unavailable')
        const board: AssignmentBoard = await response.json()
        if (!cancelled)
          setLabel(
            `Assigned today to ${board.rows[0]?.assignment.assigneeName || 'nobody'}. Colleagues can cover this work.`,
          )
      })
      .catch(() => {
        if (!cancelled) setLabel('The allocation is unavailable. You can still complete this work.')
      })
    return () => {
      cancelled = true
    }
  }, [kind, targetId])
  return (
    <p className="text-sm text-[rgb(var(--text-muted))]" role="status">
      {label}
    </p>
  )
}
