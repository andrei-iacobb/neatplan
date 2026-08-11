"use client"

import { useState, useEffect, useMemo, type CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Loader2,
  CheckCircle2,
  Circle,
  ArrowLeft,
  Clock,
  Wrench,
  Calendar,
  User,
  Save,
  CheckSquare,
  AlertTriangle,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { apiRequest } from '@/lib/url-utils'
import { frequencyLabel } from '@/lib/schedule-frequency'
import { useThemeColors } from '@/hooks/useThemeColors'
import { PageLoading, Spinner } from '@/components/ui/loading'
import { SignaturePad } from '@/components/cleaner/signature-pad'

interface ScheduleTask {
  id: string
  description: string
  frequency?: string
  additionalNotes?: string
}

interface EquipmentSchedule {
  id: string
  title: string
  frequency: string
  nextDue: string
  status: 'PENDING' | 'OVERDUE' | 'COMPLETED' | 'PAUSED' | 'NOT_DUE_YET'
  tasks: ScheduleTask[]
  estimatedDuration: string
  completedToday?: boolean
}

interface Equipment {
  id: string
  name: string
  type: string
  description?: string
  assetCode?: string
  schedules: EquipmentSchedule[]
}

interface CompletedTask {
  taskId: string
  notes?: string
}

const JUNK_NOTE_RESIDUE = /^(equipment|week of|date|name)$/i

// Filters out fill-in-the-blank template fragments captured during document
// extraction, e.g. "_______________ Equipment" or "Week of: ____".
function isJunkNote(note: string): boolean {
  const residue = note
    .replace(/[_\-.\u2013\u2014\u2026:;,|/\\()[\]{}'"`~*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return residue.replace(/\s+/g, '').length <= 4 || JUNK_NOTE_RESIDUE.test(residue)
}

export default function CleanEquipmentPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const tc = useThemeColors()
  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [completedTasks, setCompletedTasks] = useState<Map<string, CompletedTask>>(new Map())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [expandedSchedules, setExpandedSchedules] = useState<Set<string>>(new Set())
  // Sign-off state. Signatures are keyed per schedule so two open schedules cannot
  // share one signature; the printed name is per-session.
  const [signatures, setSignatures] = useState<Record<string, string | null>>({})
  const [signedName, setSignedName] = useState('')
  const [blockedScheduleId, setBlockedScheduleId] = useState<string | null>(null)
  // Sign-off problems are shown inline next to the pad. They must never go through
  // `error`, which unmounts the whole equipment and would throw away the ticked tasks.
  const [signOffError, setSignOffError] = useState<string | null>(null)

  /*
   * A cleaner works exactly one schedule at a time. The page opens on a single
   * schedule - the most urgent one still outstanding - and the rest stay hidden
   * until it is signed off. Deliberately no picker; mirrors the room flow.
   *
   * Derived rather than stored so it cannot drift out of step with the ticks and
   * the schedule data it is based on.
   */
  const activeScheduleId = useMemo(() => {
    if (!equipment) return null

    /*
     * A schedule with ticks against it is already underway, so it wins outright.
     * Task keys are `${scheduleId}-${taskId}` and both halves are cuids, so the id
     * has to be matched by prefix against the known schedules, not by splitting.
     */
    const keys = Array.from(completedTasks.keys())
    const started = equipment.schedules.find(s => keys.some(k => k.startsWith(`${s.id}-`)))
    if (started) return started.id

    const outstanding = equipment.schedules.filter(s => !s.completedToday)
    if (outstanding.length === 0) return null

    // Read `status`/`nextDue` directly - getScheduleStatus is declared below and
    // would be in its TDZ at this point in the render.
    const urgency = (s: EquipmentSchedule) => (s.status === 'OVERDUE' ? 0 : 1)
    return [...outstanding].sort((a, b) =>
      urgency(a) - urgency(b) ||
      new Date(a.nextDue).getTime() - new Date(b.nextDue).getTime()
    )[0].id
  }, [equipment, completedTasks])

  const visibleSchedules = useMemo(() => {
    if (!equipment) return []
    return activeScheduleId
      ? equipment.schedules.filter(s => s.id === activeScheduleId)
      : equipment.schedules
  }, [equipment, activeScheduleId])

  // Pre-print the cleaner's name the way a paper sign-off sheet does; still editable.
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.name && !signedName) {
      setSignedName(session.user.name)
    }
  }, [status, session?.user?.name, signedName])

  // Redirect admins away from cleaner interface
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.isAdmin) {
      router.replace('/')
      return
    }
  }, [status, session, router])

  useEffect(() => {
    if (params.equipmentId && status === 'authenticated' && !session?.user?.isAdmin) {
      fetchEquipmentData()
      setStartTime(new Date())
    }
  }, [params.equipmentId, status, session])

  // Auto-expand schedules that are due today, tomorrow, or overdue
  useEffect(() => {
    if (equipment?.schedules) {
      const autoExpandIds = new Set<string>()

      equipment.schedules.forEach(schedule => {
        const scheduleStatus = getScheduleStatus(schedule)

        // Auto-expand if overdue or pending (due within 48 hours)
        if (scheduleStatus === 'OVERDUE' || scheduleStatus === 'PENDING') {
          autoExpandIds.add(schedule.id)
        }
      })

      setExpandedSchedules(autoExpandIds)
    }
  }, [equipment])

  const fetchEquipmentData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await apiRequest(`/api/cleaner/equipment/${params.equipmentId}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Equipment not found')
        }
        throw new Error('Failed to fetch equipment data')
      }

      const data = await response.json()
      setEquipment(data)
    } catch (err) {
      console.error('Error fetching equipment:', err)
      setError(err instanceof Error ? err.message : 'Failed to load equipment data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTaskToggle = (scheduleId: string, taskId: string, task: ScheduleTask) => {
    setSignOffError(null)
    const key = `${scheduleId}-${taskId}`
    setCompletedTasks(prev => {
      const newMap = new Map(prev)
      if (newMap.has(key)) {
        newMap.delete(key)
      } else {
        newMap.set(key, { taskId, notes: '' })
      }
      return newMap
    })
  }

  const handleTaskNotes = (scheduleId: string, taskId: string, notes: string) => {
    const key = `${scheduleId}-${taskId}`
    setCompletedTasks(prev => {
      const newMap = new Map(prev)
      if (newMap.has(key)) {
        newMap.set(key, { taskId, notes })
      }
      return newMap
    })
  }

  const getCompletionProgress = (schedule: EquipmentSchedule) => {
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

    const hasTask = Array.from(completedTasks.keys()).some(key => key.startsWith(`${scheduleId}-`))
    if (!hasTask) {
      blockers.push({ field: 'tasks', message: 'Tick at least one task you completed' })
    }
    if (!signatures[scheduleId]) {
      blockers.push({ field: 'signature', message: 'Sign in the box to confirm this equipment is done' })
    }
    if (signedName.trim().length < 2 || signedName.trim().length > 80) {
      blockers.push({ field: 'name', message: 'Enter your printed name (2-80 characters)' })
    }

    return blockers
  }

  const handleCompleteSchedule = async (scheduleId: string) => {
    if (!equipment || !startTime) return

    const schedule = equipment.schedules.find(s => s.id === scheduleId)
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

    // Get completed tasks for this schedule
    const scheduleCompletedTasks = Array.from(completedTasks.entries())
      .filter(([key]) => key.startsWith(`${scheduleId}-`))
      .map(([key, value]) => ({
        taskId: value.taskId,
        notes: value.notes
      }))

    setIsSubmitting(true)
    try {
      const endTime = new Date()
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000 / 60) // minutes

      const response = await apiRequest(`/api/cleaner/equipment/${params.equipmentId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scheduleId,
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

  const toggleScheduleExpansion = (scheduleId: string) => {
    const newExpanded = new Set(expandedSchedules)
    if (newExpanded.has(scheduleId)) {
      newExpanded.delete(scheduleId)
    } else {
      newExpanded.add(scheduleId)
    }
    setExpandedSchedules(newExpanded)
  }

  const getScheduleStatus = (schedule: EquipmentSchedule) => {
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

  const isScheduleDueToday = (schedule: EquipmentSchedule) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(schedule.nextDue)
    dueDate.setHours(0, 0, 0, 0)

    return dueDate.getTime() === today.getTime()
  }

  const isScheduleUrgent = (schedule: EquipmentSchedule) => {
    const status = getScheduleStatus(schedule)
    return status === 'OVERDUE' || status === 'PENDING'
  }

  const getDueDateDisplay = (schedule: EquipmentSchedule) => {
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
        <PageLoading cards={3} label="Loading equipment" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: tc.statusOverdue.text }} />
          <h2 className="text-xl font-semibold mb-2" style={{ color: tc.textPrimary }}>
            {error === 'Equipment not found' ? 'Equipment Not Found' : 'Something went wrong'}
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
            {error !== 'Equipment not found' && (
              <button
                onClick={fetchEquipmentData}
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

  if (!equipment) {
    return null
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
            className="transition-colors p-2 rounded-lg"
            style={{ color: tc.textMuted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = tc.btnPrimaryText; e.currentTarget.style.background = tc.btnSecondaryHoverBg }}
            onMouseLeave={(e) => { e.currentTarget.style.color = tc.textMuted; e.currentTarget.style.removeProperty('background') }}
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="flex items-center gap-3 min-w-0">
            <Wrench className="w-8 h-8 shrink-0" style={{ color: tc.btnPrimaryText }} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold break-words" style={{ color: tc.textPrimary }}>{equipment.name}</h1>
                {equipment.assetCode && (
                  <div className="text-xs font-mono px-2.5 py-1 rounded-sm" style={{ background: tc.surfaceBg, color: tc.accentGreen, border: `1px solid ${tc.accentGreen}` }}>
                    {equipment.assetCode}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm" style={{ color: tc.textMuted }}>
                <span className="truncate">{equipment.type.replace('_', ' ')}</span>
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
            onMouseLeave={(e) => { e.currentTarget.style.color = tc.textMuted; e.currentTarget.style.removeProperty('background') }}
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
            // The claimed schedule stays open - collapsing it would leave a blank page.
            const isActive = schedule.id === activeScheduleId
            const isExpanded = isActive || expandedSchedules.has(schedule.id)
            const actualStatus = schedule.completedToday ? 'COMPLETED' : getScheduleStatus(schedule)
            const isDueToday = isScheduleDueToday(schedule)
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
                  className={`p-4 transition-colors ${isActive ? '' : 'cursor-pointer'}`}
                  style={{ background: isUrgent ? tc.surfaceBg : undefined }}
                  onMouseEnter={(e) => { if (!isUrgent && !isActive) e.currentTarget.style.background = tc.hoverRow }}
                  onMouseLeave={(e) => {
                    if (isUrgent) e.currentTarget.style.background = tc.surfaceBg
                    else e.currentTarget.style.removeProperty('background')
                  }}
                  onClick={isActive ? undefined : () => toggleScheduleExpansion(schedule.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" style={{ color: tc.textMuted }} />
                          ) : (
                            <ChevronRight className="w-4 h-4" style={{ color: tc.textMuted }} />
                          )}
                          <h2
                            className="text-lg font-semibold"
                            style={{ color: isUrgent ? tc.btnPrimaryText : tc.textSecondary }}
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
                          <span>{frequencyLabel(schedule.frequency)}</span>
                        </div>
                        <span style={{ color: tc.textMuted }}>•</span>
                        <span style={{ color: tc.textSecondary }}>Est. {schedule.estimatedDuration}</span>
                      </div>
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
                                  role="button"
                                  tabIndex={0}
                                  aria-pressed={isCompleted}
                                  aria-label={`${isCompleted ? 'Mark incomplete' : 'Mark complete'}: ${task.description}`}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: taskIndex * 0.05 }}
                                  whileHover={{ backgroundColor: isCompleted ? tc.btnPrimaryHoverBg : tc.cardHoverBg }}
                                  onClick={() => handleTaskToggle(schedule.id, task.id, task)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault()
                                      handleTaskToggle(schedule.id, task.id, task)
                                    }
                                  }}
                                  className="p-4 rounded-lg border cursor-pointer transition-colors focus-visible:outline-hidden focus-visible:ring-2"
                                  style={{
                                    backgroundColor: isCompleted ? tc.statusCompleted.bg : tc.surfaceBg,
                                    borderColor: isCompleted ? tc.statusCompleted.border : tc.cardBorder,
                                    outlineColor: tc.inputFocusBorder,
                                  }}
                                >
                                  <div className="flex items-start gap-3">
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

                                    <div className="flex-1">
                                      <p
                                        className={`font-medium ${isCompleted ? 'line-through' : ''}`}
                                        style={{ color: isCompleted ? tc.statusCompleted.text : tc.textPrimary }}
                                      >
                                        {task.description}
                                      </p>

                                      {task.additionalNotes && !isJunkNote(task.additionalNotes) && (
                                        <p className="text-sm mt-1" style={{ color: tc.textMuted }}>
                                          {task.additionalNotes}
                                        </p>
                                      )}

                                      {task.frequency && task.frequency !== schedule.frequency && (
                                        <span
                                          className="text-xs px-2 py-1 rounded-sm mt-2 inline-block"
                                          style={{ color: tc.tabActiveText, backgroundColor: tc.tabActiveBg }}
                                        >
                                          {task.frequency}
                                        </span>
                                      )}

                                      {/* Task Notes */}
                                      <AnimatePresence>
                                        {isCompleted && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="mt-3"
                                          >
                                            <input
                                              type="text"
                                              placeholder="Add notes (optional)..."
                                              value={completedTasks.get(taskKey)?.notes || ''}
                                              onChange={(e) => handleTaskNotes(schedule.id, task.id, e.target.value)}
                                              onClick={(e) => e.stopPropagation()}
                                              onKeyDown={(e) => e.stopPropagation()}
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
                                    </div>
                                  </div>
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
                              label="Sign to confirm this equipment is done"
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
                              disabled={isSubmitting || progress.completed === 0}
                              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                                progress.completed > 0 && !isSubmitting ? '' : 'cursor-not-allowed'
                              }`}
                              style={
                                progress.completed > 0 && !isSubmitting
                                  ? { background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: '1px solid ' + tc.btnPrimaryBorder }
                                  : { background: tc.btnSecondaryBg, color: tc.textMuted, border: '1px solid ' + tc.btnSecondaryBorder }
                              }
                              onMouseEnter={(e) => {
                                if (progress.completed > 0 && !isSubmitting) e.currentTarget.style.background = tc.btnPrimaryHoverBg
                              }}
                              onMouseLeave={(e) => {
                                if (progress.completed > 0 && !isSubmitting) e.currentTarget.style.background = tc.btnPrimaryBg
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
                                  Complete Schedule ({progress.completed} tasks)
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
        {equipment.schedules.length === 0 && (
          <div className="text-center py-12">
            <CheckSquare className="w-16 h-16 mx-auto mb-4" style={{ color: tc.statusCompleted.text }} />
            <h3 className="text-xl font-semibold mb-2" style={{ color: tc.textPrimary }}>No active schedules</h3>
            <p className="mb-4" style={{ color: tc.textMuted }}>This equipment doesn't have any pending cleaning schedules.</p>
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
