'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useThemeColors } from '@/hooks/useThemeColors'
import { ScheduleUploader } from '@/components/ScheduleUploader'
import { ScheduleDialog } from '@/components/ScheduleDialog'
import { ScheduleList } from '@/components/ScheduleList'
import { Settings2, Sparkles } from 'lucide-react'
import type { Schedule, ScheduleTask } from '@/types/schedule'
import { ToastProvider } from '@/components/ui/toast-context'
import { apiRequest } from '@/lib/url-utils'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }

function SchedulePageContent() {
  const tc = useThemeColors()
  const [schedules, setSchedules] = useState<(Schedule & { tasks: ScheduleTask[] })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)

  const fetchSchedules = async () => {
    try {
      setError(null)
      const res = await apiRequest('/api/schedules')
      if (!res.ok) throw new Error('Failed to fetch schedules')
      const data = await res.json()
      // Ensure we're setting a valid array
      setSchedules(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch schedules:', error)
      setError('Failed to fetch schedules')
      // Reset schedules to empty array on error
      setSchedules([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedules()
  }, [])

  const handleScheduleGenerated = (schedule: Schedule & { tasks: ScheduleTask[] }) => {
    setSchedules(prev => [...prev, schedule])
  }

  return (
    <div className="max-w-[1100px] mx-auto relative z-10 pb-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4" style={{ color: 'rgb(16,185,129)' }} />
            <p className="text-[13px] font-medium tracking-wide uppercase" style={{ color: tc.accentLabel }}>Cleaning Schedules</p>
          </div>
          <h1 className="text-[32px] font-bold tracking-tight mb-1" style={{ color: tc.textPrimary }}>Cleaning Schedule</h1>
          <p className="text-[15px]" style={{ color: tc.textMuted }}>Manage and organize your cleaning tasks efficiently</p>
        </div>
        <button
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-200"
          style={{
            background: isEditMode ? tc.tabActiveBg : tc.btnSecondaryBg,
            color: isEditMode ? tc.tabActiveText : tc.btnSecondaryText,
            border: `1px solid ${isEditMode ? tc.tabActiveBorder : tc.btnSecondaryBorder}`,
          }}
          onMouseEnter={(e) => {
            if (!isEditMode) {
              e.currentTarget.style.background = tc.btnSecondaryHoverBg
            }
          }}
          onMouseLeave={(e) => {
            if (!isEditMode) {
              e.currentTarget.style.background = tc.btnSecondaryBg
            }
          }}
          onClick={() => setIsEditMode(!isEditMode)}
        >
          <Settings2 className="w-4 h-4" />
          {isEditMode ? 'Exit Edit Mode' : 'Edit Mode'}
        </button>
      </div>

      {/* Actions - Only visible in edit mode */}
      {isEditMode && (
        <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.06 }} className="grid sm:grid-cols-2 gap-3 mb-6">
          <div
            className="rounded-xl p-5"
            style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}
          >
            <h2 className="text-[15px] font-semibold mb-4" style={{ color: tc.textPrimary }}>Upload Schedule</h2>
            <ScheduleUploader onScheduleGenerated={handleScheduleGenerated} />
          </div>

          <div
            className="rounded-xl p-5"
            style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}
          >
            <h2 className="text-[15px] font-semibold mb-4" style={{ color: tc.textPrimary }}>Create Schedule</h2>
            <p className="text-[13px] mb-4" style={{ color: tc.textSecondary }}>Create a new cleaning schedule manually with custom tasks and frequencies.</p>
            <ScheduleDialog onScheduleCreated={fetchSchedules} />
          </div>
        </motion.div>
      )}

      {/* Schedules List */}
      <motion.div {...fadeUp} transition={{ duration: 0.35, delay: isEditMode ? 0.12 : 0.06 }}>
        {!isEditMode && schedules.length > 0 && (
          <div className="flex justify-end mb-4">
            <ScheduleDialog onScheduleCreated={fetchSchedules} />
          </div>
        )}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}
        >
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 rounded-full border-2 border-transparent"
                style={{ borderTopColor: 'rgb(16,185,129)', borderRightColor: 'rgba(16,185,129,0.3)' }}
              />
            </div>
          ) : error ? (
            <div className="p-6">
              <p className="text-[13px]" style={{ color: tc.statusOverdue.text }}>{error}</p>
            </div>
          ) : schedules.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[13px]" style={{ color: tc.textMuted }}>
                {isEditMode
                  ? "No schedules yet. Create one or upload a document to get started."
                  : "No schedules yet. Click 'Edit Mode' to create your first schedule."}
              </p>
            </div>
          ) : (
            <div className="p-6">
              <ScheduleList
                schedules={schedules}
                onUpdate={fetchSchedules}
                isEditMode={isEditMode}
              />
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
