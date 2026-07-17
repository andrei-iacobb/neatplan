'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/url-utils'
import { canAccessAllSites } from '@/lib/roles'
import { useThemeColors } from '@/hooks/useThemeColors'

interface ScheduleDialogProps {
  onScheduleCreated: () => void
}

interface SiteOption {
  id: string
  name: string
}

export function ScheduleDialog({ onScheduleCreated }: ScheduleDialogProps) {
  const tc = useThemeColors()
  const { data: session } = useSession()
  // OP/DIRECTOR span every site and pick which ones the schedule applies to;
  // MANAGER/CLEANER are pinned, so the server forces their own site.
  const canPickSite = canAccessAllSites((session?.user as any)?.role)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [frequency, setFrequency] = useState('')
  const [sites, setSites] = useState<SiteOption[]>([])
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open || !canPickSite) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiRequest('/api/sites')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          setSites(Array.isArray(data) ? data.map((s: any) => ({ id: s.id, name: s.name })) : [])
        }
      } catch {
        /* non-fatal: submit still validates that a site was chosen */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, canPickSite])

  const toggleSite = (id: string) => {
    setSelectedSiteIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }
    if (canPickSite && selectedSiteIds.length === 0) {
      toast.error('Select at least one site for this schedule')
      return
    }

    setIsLoading(true)
    try {
      const response = await apiRequest('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          frequency: frequency.trim() || null,
          tasks: [],
          siteIds: selectedSiteIds
        })
      })

      if (!response.ok) throw new Error('Failed to create schedule')

      toast.success('Schedule created')
      setOpen(false)
      setTitle('')
      setFrequency('')
      setSelectedSiteIds([])
      onScheduleCreated()
    } catch (error) {
      toast.error('Failed to create schedule')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full transition-colors"
          style={{ background: tc.btnSecondaryBg, borderColor: tc.btnSecondaryBorder, color: tc.btnSecondaryText }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Schedule
        </Button>
      </DialogTrigger>
      <DialogContent style={{ background: tc.modalBg, borderColor: tc.cardBorder }}>
        <DialogHeader>
          <DialogTitle style={{ color: tc.textPrimary }}>Create New Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: tc.textSecondary }}>Schedule Title</label>
              <Input
                placeholder="e.g., Weekly Kitchen Cleaning"
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={isLoading}
                style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: tc.textSecondary }}>Frequency</label>
              <Input
                placeholder="e.g., Daily, Weekly, Monthly"
                value={frequency}
                onChange={e => setFrequency(e.target.value)}
                disabled={isLoading}
                style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }}
              />
            </div>
            {canPickSite && (
              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: tc.textSecondary }}>Sites</label>
                <div
                  className="max-h-40 overflow-y-auto rounded-md p-2 space-y-1"
                  style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}` }}
                >
                  {sites.length === 0 ? (
                    <p className="text-xs px-1 py-1" style={{ color: tc.textMuted }}>No sites available.</p>
                  ) : (
                    sites.map(s => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 px-1 py-1 cursor-pointer text-sm"
                        style={{ color: tc.inputText }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSiteIds.includes(s.id)}
                          onChange={() => toggleSite(s.id)}
                          disabled={isLoading}
                          className="h-4 w-4 rounded"
                        />
                        {s.name}
                      </label>
                    ))
                  )}
                </div>
                <p className="text-xs" style={{ color: tc.textMuted }}>Choose one or more sites this schedule applies to.</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
              style={{ background: 'transparent', borderColor: tc.btnSecondaryBorder, color: tc.btnSecondaryText }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              style={{ background: tc.btnPrimaryBg, borderColor: tc.btnPrimaryBorder, color: tc.btnPrimaryText }}
            >
              {isLoading ? 'Creating...' : 'Create Schedule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
