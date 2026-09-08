"use client"

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle2, 
  Circle, 
  ArrowLeft, 
  Clock, 
  MapPin, 
  Calendar,
  User,
  Save,
  CheckSquare,
  RotateCcw,
  ChevronDown,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { apiRequest } from '@/lib/url-utils'
import { frequencyLabel } from '@/lib/schedule-frequency'
import { useThemeColors } from '@/hooks/useThemeColors'
import { PageLoading, Spinner } from '@/components/ui/loading'
import { SignaturePad } from '@/components/cleaner/signature-pad'
import { canUseCleaningPortal } from '@/lib/roles'

interface ScheduleTask {
  id: string
  description: string
  frequency?: string
  additionalNotes?: string
  taskRefs?: { scheduleId: string; taskId: string }[]
}

interface RoomSchedule {
  id: string
  title: string
  frequency: string
  nextDue: string
  status: 'PENDING' | 'OVERDUE' | 'COMPLETED' | 'PAUSED' | 'NOT_DUE_YET'
  tasks: ScheduleTask[]
  estimatedDuration: string
  completedToday?: boolean
  scheduleIds?: string[]
  sourceTitles?: string[]
}

interface Room {
  id: string
  name: string
  type: string
  floor: string
  description?: string
  schedules: RoomSchedule[]
  workPackage: RoomSchedule | null
}

interface CompletedTask {
  taskId: string
  taskRefs: { scheduleId: string; taskId: string }[]
  notes?: string
}

const JUNK_NOTE_RESIDUE = /^(room|week of|date|name)$/i

// Filters out fill-in-the-blank template fragments captured during document
// extraction, e.g. "_______________ Room" or "Week of: ____".
function isJunkNote(note: string): boolean {
  const residue = note
    .replace(/[_\-.\u2013\u2014\u2026:;,|/\\()[\]{}'"`~*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return residue.replace(/\s+/g, '').length <= 4 || JUNK_NOTE_RESIDUE.test(residue)
}

export default function CleanRoomPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const tc = useThemeColors()
  const [room, setRoom] = useState<Room | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [completedTasks, setCompletedTasks] = useState<Map<string, CompletedTask>>(new Map())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [startTime, setStartTime] = useState<Date | null>(null)
  // Sign-off state is keyed by the current work package; the printed name is per-session.
  const [signatures, setSignatures] = useState<Record<string, string | null>>({})
  const [signedName, setSignedName] = useState('')
  const [blockedScheduleId, setBlockedScheduleId] = useState<string | null>(null)
  // Sign-off problems are shown inline next to the pad. They must never go through
  // `error`, which unmounts the whole room and would throw away the ticked tasks.
  const [signOffError, setSignOffError] = useState<string | null>(null)

  // The server combines every schedule due for this visit into one deterministic
  // work package. Cleaners never choose between daily/weekly/deep-clean cards.
  const visibleSchedules = room?.workPackage ? [room.workPackage] : []

  const fetchRoomData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await apiRequest(`/api/cleaner/rooms/${params.roomId}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Room not found')
        }
        throw new Error('Failed to fetch room data')
      }

      const data = await response.json()
      setRoom(data)
    } catch (err) {
      console.error('Error fetching room:', err)
      setError(err instanceof Error ? err.message : 'Failed to load room data')
    } finally {
      setIsLoading(false)
    }
  }, [params.roomId])

  // Pre-print the cleaner's name the way a paper sign-off sheet does; still editable.
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.name && !signedName) {
      setSignedName(session.user.name)
    }
  }, [status, session?.user?.name, signedName])

  // Managers and higher use the management surface; Head of Housekeeping retains
  // cleaning duties and may complete work here.
  useEffect(() => {
    if (status === 'authenticated' && !canUseCleaningPortal(session?.user?.role)) {
      router.replace('/')
      return
    }
  }, [status, session, router])

  useEffect(() => {
    if (params.roomId && status === 'authenticated' && canUseCleaningPortal(session?.user?.role)) {
      fetchRoomData()
      setStartTime(new Date())
    }
  }, [params.roomId, status, session?.user?.role, fetchRoomData])

  const handleTaskToggle = (scheduleId: string, taskId: string, task: ScheduleTask) => {
    setSignOffError(null)
    const key = `${scheduleId}-${taskId}`
    setCompletedTasks(prev => {
      const newMap = new Map(prev)
      if (newMap.has(key)) {
        newMap.delete(key)
      } else {
        newMap.set(key, {
          taskId,
          taskRefs: task.taskRefs ?? [{ scheduleId, taskId }],
          notes: '',
        })
      }
      return newMap
    })
  }

  const handleTaskNotes = (scheduleId: string, taskId: string, notes: string) => {
    const key = `${scheduleId}-${taskId}`
    setCompletedTasks(prev => {
      const newMap = new Map(prev)
      const current = newMap.get(key)
      if (current) {
        newMap.set(key, { ...current, notes })
      }
      return newMap
    })
  }

  const getCompletionProgress = (schedule: RoomSchedule) => {
    const totalTasks = schedule.tasks.length
    const completedCount = schedule.tasks.filter(task => 
      completedTasks.has(`${schedule.id}-${task.id}`)
    ).length
    return { completed: completedCount, total: totalTasks }
  }

  // Everything standing between the cleaner and a valid sign-off, in the order they
  // should fix it. Drives both the inline checklist and the click-time message.
  const getBlockers = (scheduleId: string) => {
    const blockers: { field: 'tasks' | 'signature' | 'name'; message: string }[] = []

    const schedule = room?.workPackage?.id === scheduleId ? room.workPackage : null
    const progress = schedule ? getCompletionProgress(schedule) : { completed: 0, total: 0 }
    if (progress.total === 0 || progress.completed !== progress.total) {
      blockers.push({ field: 'tasks', message: 'Tick every checklist task before signing off' })
    }
    if (!signatures[scheduleId]) {
      blockers.push({ field: 'signature', message: 'Sign in the box to confirm this room is done' })
    }
    if (signedName.trim().length < 2 || signedName.trim().length > 80) {
      blockers.push({ field: 'name', message: 'Enter your printed name (2-80 characters)' })
    }

    return blockers
  }

  const handleCompleteSchedule = async (scheduleId: string) => {
    if (!room || !startTime) return

    const schedule = room.workPackage?.id === scheduleId
      ? room.workPackage
      : room.schedules.find(s => s.id === scheduleId)
    if (!schedule) return

    const blockers = getBlockers(scheduleId)
    if (blockers.length > 0) {
      setBlockedScheduleId(scheduleId)
      setSignOffError(
        blockers.length === 1
          ? `Can't complete yet - ${blockers[0].message.toLowerCase()}.`
          : `Can't complete yet - ${blockers.map(b => b.message.toLowerCase()).join(', and ')}.`
      )
      // Send focus to the first thing that needs fixing so the reason is unmissable.
      const first = blockers[0].field
      if (first === 'name') {
        document.getElementById(`signed-name-${scheduleId}`)?.focus()
      } else if (first === 'signature') {
        document
          .getElementById(`sign-off-${scheduleId}`)
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
      return
    }

    setBlockedScheduleId(null)

    // Get completed merged rows for this work package. Each row carries the
    // original task IDs it represents so the server can write one audit record
    // per underlying schedule without asking the cleaner to repeat work.
    const scheduleCompletedTasks = Array.from(completedTasks.entries())
      .filter(([key]) => key.startsWith(`${scheduleId}-`))
      .map(([, value]) => ({
        taskRefs: value.taskRefs,
        notes: value.notes,
      }))
    const scheduleIds = schedule.scheduleIds ?? [schedule.id]

    setIsSubmitting(true)
    try {
      const endTime = new Date()
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60) // minutes

      const response = await apiRequest(`/api/cleaner/rooms/${params.roomId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scheduleId: scheduleIds.length === 1 ? scheduleIds[0] : undefined,
          scheduleIds,
          completedTasks: scheduleCompletedTasks,
          notes,
          duration,
          signature: signatures[scheduleId],
          signedName: signedName.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        if (response.status === 409 && errorData?.duplicate) {
          setBlockedScheduleId(scheduleId)
          setSignOffError('Already completed today - this schedule has been signed off once already. Nothing more to do here.')
          return
        }

        throw new Error(errorData.error || 'Failed to complete schedule')
      }

      // Show success and redirect
      router.push('/clean?completed=true')
    } catch (err) {
      console.error('Error completing schedule:', err)
      // Keep the cleaner on the page with their ticks and signature intact so they can
      // retry - a failed submit is not a reason to lose the work.
      setBlockedScheduleId(scheduleId)
      setSignOffError(err instanceof Error ? err.message : 'Failed to complete schedule')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetTasks = () => {
    setCompletedTasks(new Map())
    setNotes('')
    setSignatures({})
    setBlockedScheduleId(null)
    setSignOffError(null)
  }

  const getScheduleStatus = (schedule: RoomSchedule) => {
    if (schedule.status === 'COMPLETED') return 'COMPLETED'
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(schedule.nextDue)
    dueDate.setHours(0, 0, 0, 0)
    
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return 'OVERDUE'
    } else if (diffDays <= 2) { // Due today, tomorrow, or day after (within 48 hours)
      return 'PENDING'
    } else {
      return 'NOT_DUE_YET'
    }
  }

  const isScheduleUrgent = (schedule: RoomSchedule) => {
    const status = getScheduleStatus(schedule)
    return status === 'OVERDUE' || status === 'PENDING'
  }

  const getDueDateDisplay = (schedule: RoomSchedule) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(schedule.nextDue)
    dueDate.setHours(0, 0, 0, 0)
    
    const diffTime = dueDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays)
      return {
        text: `${overdueDays} day${overdueDays > 1 ? 's' : ''} overdue`,
        color: tc.statusOverdue.text,
        urgent: true
      }
    } else if (diffDays === 0) {
      return { text: 'Due today', color: tc.statusOverdue.text, urgent: true }
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', color: tc.statusPending.text, urgent: true }
    } else if (diffDays === 2) {
      return { text: 'Due in 2 days', color: tc.statusPending.text, urgent: true }
    } else if (diffDays <= 7) {
      return { text: `Due in ${diffDays} days`, color: tc.textSecondary, urgent: false }
    } else {
      return { text: `Due in ${diffDays} days`, color: tc.textMuted, urgent: false }
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="max-w-[1100px] mx-auto relative z-10 pb-8">
        <PageLoading cards={3} label="Loading room" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: tc.statusOverdue.text }} />
          <h2 className="text-xl font-semibold mb-2" style={{ color: tc.textPrimary }}>
            {error === 'Room not found' ? 'Room Not Found' : 'Something went wrong'}
          </h2>
          <p className="mb-4" style={{ color: tc.textMuted }}>{error}</p>
          <div className="space-x-4">
            <Link
              href="/clean"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
              style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: '1px solid ' + tc.btnPrimaryBorder }}
              onMouseEnter={(e) => e.currentTarget.style.background = tc.btnPrimaryHoverBg}
              onMouseLeave={(e) => e.currentTarget.style.background = tc.btnPrimaryBg}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
            {error !== 'Room not found' && (
              <button
                onClick={fetchRoomData}
                className="px-4 py-2 rounded-lg transition-colors"
                style={{ background: tc.btnSecondaryBg, color: tc.btnSecondaryText, border: '1px solid ' + tc.btnSecondaryBorder }}
                onMouseEnter={(e) => e.currentTarget.style.background = tc.btnSecondaryHoverBg}
                onMouseLeave={(e) => e.currentTarget.style.background = tc.btnSecondaryBg}
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!room) {
    return null
  }

  const getRoomTypeIcon = (type: string) => {
    switch (type) {
      case 'BEDROOM': return '🛏️'
      case 'BATHROOM': return '🚿'
      case 'KITCHEN': return '🍳'
      case 'OFFICE': return '💼'
      case 'MEETING_ROOM': return '🪑'
      default: return '🏠'
    }
  }

  const getStatusStyle = (status: string): CSSProperties => {
    const palette =
      status === 'OVERDUE' ? tc.statusOverdue :
      status === 'PENDING' ? tc.statusPending :
      status === 'NOT_DUE_YET' ? tc.statusActive :
      status === 'COMPLETED' ? tc.statusCompleted :
      null
    if (palette) {
      return { background: palette.bg, color: palette.text, border: '1px solid ' + palette.border }
    }
    // PAUSED / unknown
    return { background: tc.emptyBg, color: tc.textMuted, border: '1px solid ' + tc.cardBorder }
  }

  const getStatusDisplayName = (status: string) => {
    switch (status) {
      case 'OVERDUE': return 'Overdue'
      case 'PENDING': return 'Due Soon'
      case 'NOT_DUE_YET': return 'Scheduled'
      case 'COMPLETED': return 'Completed'
      case 'PAUSED': return 'Paused'
      default: return status
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/clean"
            aria-label="Back to cleaner dashboard"
            className="transition-colors p-2 rounded-lg"
            style={{ color: tc.textMuted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = tc.btnPrimaryText; e.currentTarget.style.background = tc.btnSecondaryHoverBg }}
            onMouseLeave={(e) => { e.currentTarget.style.color = tc.textMuted; e.currentTarget.style.background = 'transparent' }}
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl shrink-0">{getRoomTypeIcon(room.type)}</span>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold break-words" style={{ color: tc.textPrimary }}>{room.name}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm" style={{ color: tc.textMuted }}>
                <div className="flex items-center gap-1 min-w-0">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span className="truncate">{room.floor}</span>
                </div>
                <span aria-hidden="true">•</span>
                <span className="truncate">{room.type.replace('_', ' ')}</span>
                <span aria-hidden="true">•</span>
                <div className="flex items-center gap-1 min-w-0">
                  <User className="w-4 h-4 shrink-0" />
                  <span className="truncate">{session?.user?.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-sm" style={{ color: tc.textMuted }}>
            {startTime && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Started at {startTime.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
          <button
            onClick={resetTasks}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
            style={{ color: tc.textMuted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = tc.textSecondary; e.currentTarget.style.background = tc.btnSecondaryHoverBg }}
            onMouseLeave={(e) => { e.currentTarget.style.color = tc.textMuted; e.currentTarget.style.background = 'transparent' }}
          >
            <RotateCcw className="w-4 h-4" />
            Reset All
          </button>
        </div>

        {/* Schedules */}
        <div className="space-y-4">
          {visibleSchedules.map((schedule, scheduleIndex) => {
            const progress = getCompletionProgress(schedule)
            const progressPercentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0
            const canComplete = progress.total > 0 && progress.completed === progress.total
            // The claimed schedule stays open - collapsing it would leave a blank page.
            const isExpanded = true
            const actualStatus = schedule.completedToday ? 'COMPLETED' : getScheduleStatus(schedule)
            const isUrgent = isScheduleUrgent(schedule)
            const dueDateInfo = getDueDateDisplay(schedule)
            
            return (
              <motion.div
                key={schedule.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: scheduleIndex * 0.036 }}
                className="rounded-lg overflow-hidden"
                style={{ background: tc.cardBg, border: '1px solid ' + tc.cardBorder }}
              >
                {/* Schedule Header - Always Visible */}
                <div
                  className="p-4 transition-colors"
                  style={{ background: isUrgent ? tc.surfaceBg : 'transparent' }}
                  onMouseEnter={(e) => { if (!isUrgent) e.currentTarget.style.background = tc.hoverRow }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = isUrgent ? tc.surfaceBg : 'transparent' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <ChevronDown className="w-4 h-4" style={{ color: tc.textMuted }} />
                          <h2
                            className="text-lg font-semibold"
                            style={{ color: tc.textPrimary }}
                          >
                            {schedule.title}
                          </h2>
                        </div>
                        {dueDateInfo.urgent && (
                          <div className="flex items-center gap-1">
                            {actualStatus === 'OVERDUE' ? (
                              <AlertCircle className="w-4 h-4" style={{ color: tc.statusOverdue.text }} />
                            ) : (
                              <Clock className="w-4 h-4" style={{ color: tc.btnPrimaryText }} />
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <span style={{ color: dueDateInfo.color }}>
                          {schedule.completedToday ? 'Completed today' : dueDateInfo.text}
                        </span>
                        <span style={{ color: tc.textMuted }}>•</span>
                        <div className="flex items-center gap-1" style={{ color: tc.textSecondary }}>
                          <Calendar className="w-3 h-3" />
                          <span>
                            {schedule.sourceTitles && schedule.sourceTitles.length > 1
                              ? `${schedule.sourceTitles.length} schedules combined`
                              : frequencyLabel(schedule.frequency)}
                          </span>
                        </div>
                        <span style={{ color: tc.textMuted }}>•</span>
                        <span style={{ color: tc.textSecondary }}>Est. {schedule.estimatedDuration}</span>
                      </div>
                      {schedule.sourceTitles && schedule.sourceTitles.length > 1 && (
                        <p className="mt-2 text-xs leading-relaxed" style={{ color: tc.textMuted }}>
                          Includes: {schedule.sourceTitles.join(' + ')}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {isExpanded && (
                        <div className="text-right">
                          <div className="text-sm" style={{ color: tc.textSecondary }}>
                            {progress.completed} of {progress.total} tasks
                          </div>
                          <div className="text-xs" style={{ color: tc.textMuted }}>
                            {Math.round(progressPercentage)}% complete
                          </div>
                        </div>
                      )}
                      <span className="px-2 py-1 rounded-full text-xs" style={getStatusStyle(actualStatus)}>
                        {getStatusDisplayName(actualStatus)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expandable Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t" style={{ borderColor: tc.divider }}>
                        {/* Progress Bar */}
                        <div className="p-6 border-b" style={{ borderColor: tc.divider }}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium" style={{ color: tc.textSecondary }}>
                              Progress: {progress.completed} of {progress.total} tasks
                            </span>
                            <span className="text-sm" style={{ color: tc.textMuted }}>{Math.round(progressPercentage)}%</span>
                          </div>
                          <div className="w-full rounded-full h-2" style={{ background: tc.progressBg }}>
                            <motion.div
                              className="h-2 rounded-full"
                              style={{ background: tc.accentGreen }}
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPercentage}%` }}
                              transition={{ duration: 0.5 }}
                            />
                          </div>
                        </div>

                        {/* Tasks List */}
                        <div className="p-6">
                          <div className="space-y-3">
                            {schedule.tasks.map((task, taskIndex) => {
                              const taskKey = `${schedule.id}-${task.id}`
                              const isCompleted = completedTasks.has(taskKey)
                              
                              return (
                                <motion.div
                                  key={task.id}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: taskIndex * 0.05 }}
                                  className="rounded-lg border overflow-hidden"
                                  style={{
                                    backgroundColor: isCompleted ? tc.statusCompleted.bg : tc.surfaceBg,
                                    borderColor: isCompleted ? tc.statusCompleted.border : tc.cardBorder
                                  }}
                                >
                                  <motion.button
                                    type="button"
                                    aria-pressed={isCompleted}
                                    aria-label={`${isCompleted ? 'Mark incomplete' : 'Mark complete'}: ${task.description}`}
                                    whileHover={{ backgroundColor: isCompleted ? tc.btnPrimaryHoverBg : tc.cardHoverBg }}
                                    onClick={() => handleTaskToggle(schedule.id, task.id, task)}
                                    className="w-full p-4 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(16,185,129,0.6)]"
                                  >
                                    <span className="flex items-start gap-3">
                                      <span
                                        aria-hidden="true"
                                        className="mt-1 transition-colors"
                                        style={{ color: isCompleted ? tc.statusCompleted.text : tc.textMuted }}
                                      >
                                        {isCompleted ? (
                                          <CheckCircle2 className="w-5 h-5" />
                                        ) : (
                                          <Circle className="w-5 h-5" />
                                        )}
                                      </span>

                                      <span className="flex-1">
                                        <span
                                          className={`block font-medium ${isCompleted ? 'line-through' : ''}`}
                                          style={{ color: tc.textPrimary }}
                                        >
                                          {task.description}
                                        </span>

                                        {task.additionalNotes && !isJunkNote(task.additionalNotes) && (
                                          <span className="block text-sm mt-1" style={{ color: tc.textMuted }}>
                                            {task.additionalNotes}
                                          </span>
                                        )}

                                        {task.frequency && task.frequency !== schedule.frequency && (
                                          <span
                                            className="text-xs px-2 py-1 rounded-sm mt-2 inline-block"
                                            style={{ color: tc.tabActiveText, backgroundColor: tc.tabActiveBg }}
                                          >
                                            {task.frequency}
                                          </span>
                                        )}
                                      </span>
                                    </span>
                                  </motion.button>

                                  <AnimatePresence>
                                    {isCompleted && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="px-4 pb-4"
                                      >
                                        <input
                                          type="text"
                                          aria-label={`Notes for ${task.description}`}
                                          placeholder="Add notes (optional)..."
                                          value={completedTasks.get(taskKey)?.notes || ''}
                                          onChange={(e) => handleTaskNotes(schedule.id, task.id, e.target.value)}
                                          onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                                          onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}
                                          className="w-full px-3 py-2 border rounded-sm text-sm placeholder:text-[rgb(var(--muted-foreground))] focus:outline-hidden"
                                          style={{
                                            backgroundColor: tc.inputBg,
                                            borderColor: tc.inputBorder,
                                            color: tc.inputText
                                          }}
                                        />
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </motion.div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Schedule Footer */}
                        <div className="px-6 pb-6">
                          <div className="mb-4">
                            <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                              General Notes (optional)
                            </label>
                            <textarea
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="Add any additional notes about this cleaning session..."
                              rows={3}
                              onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                              onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}
                              className="w-full px-3 py-2 border rounded-sm placeholder:text-[rgb(var(--muted-foreground))] focus:outline-hidden resize-none"
                              style={{
                                backgroundColor: tc.inputBg,
                                borderColor: tc.inputBorder,
                                color: tc.inputText
                              }}
                            />
                          </div>

                          {/* Sign-off. A completion is a compliance record, so the cleaner
                              puts their name and signature to it before it can be filed. */}
                          <div id={`sign-off-${schedule.id}`} className="mb-4">
                            <label
                              htmlFor={`signed-name-${schedule.id}`}
                              className="block text-sm font-medium mb-2"
                              style={{ color: tc.textSecondary }}
                            >
                              Printed name
                            </label>
                            <input
                              id={`signed-name-${schedule.id}`}
                              type="text"
                              value={signedName}
                              onChange={(e) => {
                                setSignedName(e.target.value)
                                setSignOffError(null)
                              }}
                              placeholder="Your full name"
                              maxLength={80}
                              autoComplete="name"
                              onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                              onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}
                              className="w-full px-3 py-2 mb-4 border rounded-sm min-h-[44px] placeholder:text-[rgb(var(--muted-foreground))] focus:outline-hidden"
                              style={{
                                backgroundColor: tc.inputBg,
                                borderColor: tc.inputBorder,
                                color: tc.inputText
                              }}
                            />

                            <SignaturePad
                              label="Sign to confirm this room is done"
                              value={signatures[schedule.id] ?? null}
                              onChange={(dataUrl) => {
                                setSignatures(prev => ({ ...prev, [schedule.id]: dataUrl }))
                                setSignOffError(null)
                              }}
                              disabled={isSubmitting}
                              invalid={blockedScheduleId === schedule.id && !signatures[schedule.id]}
                            />

                            {blockedScheduleId === schedule.id && signOffError && (
                              <p
                                role="alert"
                                className="mt-3 text-sm flex items-start gap-2"
                                style={{ color: tc.statusOverdue.text }}
                              >
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                                {signOffError}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-3">
                            <button
                              onClick={() => handleCompleteSchedule(schedule.id)}
                              disabled={isSubmitting || !canComplete}
                              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                                canComplete && !isSubmitting ? '' : 'cursor-not-allowed'
                              }`}
                              style={
                                canComplete && !isSubmitting
                                  ? { background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: '1px solid ' + tc.btnPrimaryBorder }
                                  : { background: tc.btnSecondaryBg, color: tc.textMuted, border: '1px solid ' + tc.btnSecondaryBorder }
                              }
                              onMouseEnter={(e) => {
                                if (canComplete && !isSubmitting) e.currentTarget.style.background = tc.btnPrimaryHoverBg
                              }}
                              onMouseLeave={(e) => {
                                if (canComplete && !isSubmitting) e.currentTarget.style.background = tc.btnPrimaryBg
                              }}
                            >
                              {isSubmitting ? (
                                <>
                                  <Spinner size="sm" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4" />
                                  Complete Room ({progress.completed} tasks)
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-6 p-4 rounded-lg"
              style={{ background: tc.statusOverdue.bg, border: '1px solid ' + tc.statusOverdue.border }}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" style={{ color: tc.statusOverdue.text }} />
                <p style={{ color: tc.statusOverdue.text }}>{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* No Schedules */}
        {!room.workPackage && (
          <div className="text-center py-12">
            <CheckSquare className="w-16 h-16 mx-auto mb-4" style={{ color: tc.statusCompleted.text }} />
            <h3 className="text-xl font-semibold mb-2" style={{ color: tc.textPrimary }}>Nothing else to clean</h3>
            <p className="mb-4" style={{ color: tc.textMuted }}>Every schedule due for this room has been completed today.</p>
            <Link
              href="/clean"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
              style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: '1px solid ' + tc.btnPrimaryBorder }}
              onMouseEnter={(e) => e.currentTarget.style.background = tc.btnPrimaryHoverBg}
              onMouseLeave={(e) => e.currentTarget.style.background = tc.btnPrimaryBg}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
