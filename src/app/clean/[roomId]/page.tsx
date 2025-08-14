"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Loader2, 
  CheckCircle2, 
  Circle, 
  ArrowLeft, 
  Clock, 
  MapPin, 
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

interface ScheduleTask {
  id: string
  description: string
  frequency?: string
  additionalNotes?: string
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
}

interface Room {
  id: string
  name: string
  type: string
  floor: string
  description?: string
  schedules: RoomSchedule[]
}

interface CompletedTask {
  taskId: string
  notes?: string
}

export default function CleanRoomPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [room, setRoom] = useState<Room | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [completedTasks, setCompletedTasks] = useState<Map<string, CompletedTask>>(new Map())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [expandedSchedules, setExpandedSchedules] = useState<Set<string>>(new Set())

  // Redirect admins away from cleaner interface
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.isAdmin) {
      router.replace('/')
      return
    }
  }, [status, session, router])

  useEffect(() => {
    if (params.roomId && status === 'authenticated' && !session?.user?.isAdmin) {
      fetchRoomData()
      setStartTime(new Date())
    }
  }, [params.roomId, status, session])

  // Auto-expand schedules that are due today, tomorrow, or overdue
  useEffect(() => {
    if (room?.schedules) {
      const autoExpandIds = new Set<string>()
      
      room.schedules.forEach(schedule => {
        const scheduleStatus = getScheduleStatus(schedule)
        
        // Auto-expand if overdue or pending (due within 48 hours)
        if (scheduleStatus === 'OVERDUE' || scheduleStatus === 'PENDING') {
          autoExpandIds.add(schedule.id)
        }
      })
      
      setExpandedSchedules(autoExpandIds)
    }
  }, [room])

  const fetchRoomData = async () => {
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
  }

  const handleTaskToggle = (scheduleId: string, taskId: string, task: ScheduleTask) => {
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

  const getCompletionProgress = (schedule: RoomSchedule) => {
    const totalTasks = schedule.tasks.length
    const completedCount = schedule.tasks.filter(task => 
      completedTasks.has(`${schedule.id}-${task.id}`)
    ).length
    return { completed: completedCount, total: totalTasks }
  }

  const handleCompleteSchedule = async (scheduleId: string) => {
    if (!room || !startTime) return

    const schedule = room.schedules.find(s => s.id === scheduleId)
    if (!schedule) return

    // Get completed tasks for this schedule
    const scheduleCompletedTasks = Array.from(completedTasks.entries())
      .filter(([key]) => key.startsWith(`${scheduleId}-`))
      .map(([key, value]) => ({
        taskId: value.taskId,
        notes: value.notes
      }))

    if (scheduleCompletedTasks.length === 0) {
      setError('Please complete at least one task before finishing')
      return
    }

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
          scheduleId,
          completedTasks: scheduleCompletedTasks,
          notes,
          duration
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to complete schedule')
      }

      // Show success and redirect
      router.push('/clean?completed=true')
    } catch (err) {
      console.error('Error completing schedule:', err)
      setError(err instanceof Error ? err.message : 'Failed to complete schedule')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetTasks = () => {
    setCompletedTasks(new Map())
    setNotes('')
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

  const isScheduleDueToday = (schedule: RoomSchedule) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dueDate = new Date(schedule.nextDue)
    dueDate.setHours(0, 0, 0, 0)
    
    return dueDate.getTime() === today.getTime()
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
        color: 'text-red-400', 
        urgent: true 
      }
    } else if (diffDays === 0) {
      return { text: 'Due today', color: 'text-teal-400', urgent: true }
    } else if (diffDays === 1) {
      return { text: 'Due tomorrow', color: 'text-yellow-400', urgent: true }
    } else if (diffDays === 2) {
      return { text: 'Due in 2 days', color: 'text-yellow-300', urgent: true }
    } else if (diffDays <= 7) {
      return { text: `Due in ${diffDays} days`, color: 'text-gray-300', urgent: false }
    } else {
      return { text: `Due in ${diffDays} days`, color: 'text-gray-400', urgent: false }
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-teal-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading room details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-100 mb-2">
            {error === 'Room not found' ? 'Room Not Found' : 'Something went wrong'}
          </h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <div className="space-x-4">
            <Link
              href="/clean"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
            {error !== 'Room not found' && (
              <button
                onClick={fetchRoomData}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OVERDUE': return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'PENDING': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      case 'NOT_DUE_YET': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'COMPLETED': return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'PAUSED': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
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
            className="text-gray-400 hover:text-teal-300 transition-colors p-2 rounded-lg hover:bg-gray-800"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-3xl">{getRoomTypeIcon(room.type)}</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-100">{room.name}</h1>
              <div className="flex items-center gap-4 text-gray-400 text-sm">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{room.floor}</span>
                </div>
                <span>•</span>
                <span>{room.type.replace('_', ' ')}</span>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>{session?.user?.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-sm text-gray-400">
            {startTime && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>Started at {startTime.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
          <button
            onClick={resetTasks}
            className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset All
          </button>
        </div>

        {/* Schedules */}
        <div className="space-y-4">
          {room.schedules.map((schedule, scheduleIndex) => {
            const progress = getCompletionProgress(schedule)
            const progressPercentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0
            const isExpanded = expandedSchedules.has(schedule.id)
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
                className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden"
              >
                {/* Schedule Header - Always Visible */}
                <div 
                  className={`p-4 cursor-pointer transition-colors ${
                    isUrgent ? 'bg-gray-800/70' : 'hover:bg-gray-800/30'
                  }`}
                  onClick={() => toggleScheduleExpansion(schedule.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          )}
                          <h2 className={`text-lg font-semibold ${
                            isUrgent ? 'text-teal-300' : 'text-gray-300'
                          }`}>
                            {schedule.title}
                          </h2>
                        </div>
                        {dueDateInfo.urgent && (
                          <div className="flex items-center gap-1">
                            {actualStatus === 'OVERDUE' ? (
                              <AlertCircle className="w-4 h-4 text-red-400" />
                            ) : (
                              <Clock className="w-4 h-4 text-teal-400" />
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm">
                        <span className={dueDateInfo.color}>
                          {schedule.completedToday ? 'Completed today' : dueDateInfo.text}
                        </span>
                        <span className="text-gray-500">•</span>
                        <div className="flex items-center gap-1 text-gray-400">
                          <Calendar className="w-3 h-3" />
                          <span>{schedule.frequency}</span>
                        </div>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-400">Est. {schedule.estimatedDuration}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {isExpanded && (
                        <div className="text-right">
                          <div className="text-sm text-gray-300">
                            {progress.completed} of {progress.total} tasks
                          </div>
                          <div className="text-xs text-gray-400">
                            {Math.round(progressPercentage)}% complete
                          </div>
                        </div>
                      )}
                      <span className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(actualStatus)}`}>
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
                      <div className="border-t border-gray-700">
                        {/* Progress Bar */}
                        <div className="p-6 border-b border-gray-700">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-300">
                              Progress: {progress.completed} of {progress.total} tasks
                            </span>
                            <span className="text-sm text-gray-400">{Math.round(progressPercentage)}%</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <motion.div
                              className="bg-teal-500 h-2 rounded-full"
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
                                  className={`p-4 rounded-lg border transition-all ${
                                    isCompleted 
                                      ? 'bg-teal-500/10 border-teal-500/30' 
                                      : 'bg-gray-700/30 border-gray-600 hover:border-gray-500'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <button
                                      onClick={() => handleTaskToggle(schedule.id, task.id, task)}
                                      className={`mt-1 transition-colors ${
                                        isCompleted ? 'text-teal-400' : 'text-gray-400 hover:text-gray-300'
                                      }`}
                                    >
                                      {isCompleted ? (
                                        <CheckCircle2 className="w-5 h-5" />
                                      ) : (
                                        <Circle className="w-5 h-5" />
                                      )}
                                    </button>
                                    
                                    <div className="flex-1">
                                      <p className={`font-medium ${
                                        isCompleted ? 'text-teal-300 line-through' : 'text-gray-100'
                                      }`}>
                                        {task.description}
                                      </p>
                                      
                                      {task.additionalNotes && (
                                        <p className="text-sm text-gray-400 mt-1">
                                          {task.additionalNotes}
                                        </p>
                                      )}
                                      
                                      {task.frequency && task.frequency !== schedule.frequency && (
                                        <span className="text-xs text-teal-400 bg-teal-400/10 px-2 py-1 rounded mt-2 inline-block">
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
                                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-gray-100 placeholder-gray-400 focus:border-teal-500 focus:outline-none"
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
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              General Notes (optional)
                            </label>
                            <textarea
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              placeholder="Add any additional notes about this cleaning session..."
                              rows={3}
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-gray-100 placeholder-gray-400 focus:border-teal-500 focus:outline-none resize-none"
                            />
                          </div>

                          <div className="flex gap-3">
                            <button
                              onClick={() => handleCompleteSchedule(schedule.id)}
                              disabled={isSubmitting || progress.completed === 0}
                              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                                progress.completed > 0 && !isSubmitting
                                  ? 'bg-teal-600 hover:bg-teal-700 text-white'
                                  : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              {isSubmitting ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
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
              className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-300">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* No Schedules */}
        {room.schedules.length === 0 && (
          <div className="text-center py-12">
            <CheckSquare className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-100 mb-2">No active schedules</h3>
            <p className="text-gray-400 mb-4">This room doesn't have any pending cleaning schedules.</p>
            <Link
              href="/clean"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
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