'use client'

import { useState, useEffect } from 'react'
import { ScheduleUploader } from '@/components/ScheduleUploader'
import { ScheduleDialog } from '@/components/ScheduleDialog'
import { ScheduleList } from '@/components/ScheduleList'
import { Loader2, Settings2 } from 'lucide-react'
import type { Schedule, ScheduleTask } from '@/types/schedule'
import { Button } from '@/components/ui/button'
import { ToastProvider } from '@/components/ui/toast-context'

function SchedulePageContent() {
  const [schedules, setSchedules] = useState<(Schedule & { tasks: ScheduleTask[] })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)

  const fetchSchedules = async () => {
    try {
      setError(null)
      const res = await fetch('/api/schedules')
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-100">Cleaning Schedule</h1>
            <p className="mt-2 text-gray-400">Manage and organize your cleaning tasks efficiently</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className={`bg-gray-800/50 border-gray-700 hover:bg-gray-800 hover:border-gray-600 transition-colors ${
              isEditMode ? 'bg-gray-800 border-gray-600' : ''
            }`}
            onClick={() => setIsEditMode(!isEditMode)}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            {isEditMode ? 'Exit Edit Mode' : 'Edit Mode'}
          </Button>
        </div>

        {/* Actions - Only visible in edit mode */}
        {isEditMode && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg p-6 shadow-lg border border-gray-800">
              <h2 className="text-lg font-medium text-gray-100 mb-4">Upload Schedule</h2>
              <ScheduleUploader onScheduleGenerated={handleScheduleGenerated} />
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg p-6 shadow-lg border border-gray-800">
              <h2 className="text-lg font-medium text-gray-100 mb-4">Create Schedule</h2>
              <p className="text-gray-400 text-sm mb-4">Create a new cleaning schedule manually with custom tasks and frequencies.</p>
              <ScheduleDialog onScheduleCreated={fetchSchedules} />
            </div>
          </div>
        )}

        {/* Schedules List */}
        <div className={isEditMode ? "mt-4" : ""}>
          {!isEditMode && schedules.length > 0 && (
            <div className="flex justify-end mb-4">
              <ScheduleDialog onScheduleCreated={fetchSchedules} />
            </div>
          )}
          <div className={`bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg shadow-lg border border-gray-800 overflow-hidden ${
            !isEditMode ? 'bg-opacity-50' : ''
          }`}>
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="p-6">
                <p className="text-red-400">{error}</p>
              </div>
            ) : schedules.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-400">
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
        </div>
      </div>
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