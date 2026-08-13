'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useThemeColors } from '@/hooks/useThemeColors'
import { ScheduleCreateDialog } from '@/components/ScheduleCreateDialog'
import { ScheduleList } from '@/components/ScheduleList'
import { Sparkles } from 'lucide-react'
import type { Schedule, ScheduleTask } from '@/types/schedule'
import { ToastProvider } from '@/components/ui/toast-context'
import { apiRequest } from '@/lib/url-utils'
import { fadeUp, enter } from '@/lib/motion'
import { ListLoading } from '@/components/ui/loading'

function SchedulePageContent() {
  const tc = useThemeColors()
  const [schedules, setSchedules] = useState<(Schedule & { tasks: ScheduleTask[]; sites?: { id: string; name: string }[] })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSchedules = async () => {
    try {
      setError(null)
      const res = await apiRequest('/api/schedules')
      if (!res.ok) throw new Error('Failed to fetch schedules')
      const data = await res.json()
      setSchedules(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch schedules:', error)
      setError('Failed to fetch schedules')
      setSchedules([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedules()
  }, [])

  return (
    <div className="max-w-[1100px] mx-auto relative z-10 pb-8">
      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4" style={{ color: 'rgb(16,185,129)' }} />
            <p className="text-[13px] font-medium tracking-wide uppercase" style={{ color: tc.accentLabel }}>Cleaning Schedules</p>
          </div>
          <h1 className="text-[32px] font-bold tracking-tight mb-1" style={{ color: tc.textPrimary }}>Cleaning Schedule</h1>
          <p className="text-[15px]" style={{ color: tc.textMuted }}>Click any schedule to edit its title, frequency and tasks</p>
        </div>
        <div className="shrink-0">
          <ScheduleCreateDialog onScheduleCreated={fetchSchedules} />
        </div>
      </div>

      {/* Schedules list */}
      <motion.div {...fadeUp} transition={enter(1)}>
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}
        >
          {isLoading ? (
            <div className="p-6">
              <ListLoading rows={5} label="Loading schedules" />
            </div>
          ) : error ? (
            <div className="p-6">
              <p className="text-[13px]" style={{ color: tc.statusOverdue.text }}>{error}</p>
            </div>
          ) : schedules.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[14px] font-medium mb-1" style={{ color: tc.textSecondary }}>No schedules yet</p>
              <p className="text-[13px] mb-5" style={{ color: tc.textMuted }}>
                Build one by hand, or drop in a document and let AI draft the tasks.
              </p>
              <div className="flex justify-center">
                <ScheduleCreateDialog onScheduleCreated={fetchSchedules} />
              </div>
            </div>
          ) : (
            <div className="p-6">
              <ScheduleList schedules={schedules} onUpdate={fetchSchedules} />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function SchedulePage() {
  return (
    <ToastProvider>
      <SchedulePageContent />
    </ToastProvider>
  )
}
