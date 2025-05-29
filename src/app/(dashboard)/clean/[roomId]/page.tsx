"use client"

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, CheckCircle2, Circle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/toast-context'

interface Task {
  id: string
  description: string
  completed: boolean
}

interface Schedule {
  id: string
  title: string
  tasks: Task[]
  frequency: string
  nextDue: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'
}

interface Room {
  id: string
  name: string
  type: string
  floor?: string
  schedules: Schedule[]
}

export default function CleanRoomPage() {
  const params = useParams()
  const { showToast } = useToast()
  const [room, setRoom] = useState<Room | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    async function fetchRoom() {
      try {
        const [roomResponse, schedulesResponse] = await Promise.all([
          fetch(`/api/rooms/${params.roomId}`),
          fetch(`/api/rooms/${params.roomId}/schedules`)
        ])

        if (!roomResponse.ok || !schedulesResponse.ok) {
          throw new Error('Failed to fetch room data')
        }

        const roomData = await roomResponse.json()
        const schedules = await schedulesResponse.json()

        setRoom({
          ...roomData,
          schedules: schedules.map((schedule: any) => ({
            ...schedule,
            tasks: schedule.schedule.tasks.map((task: any) => ({
              id: task.id,
              description: task.description,
              completed: false
            }))
          }))
        })
      } catch (error) {
        console.error('Error fetching room:', error)
        showToast('Failed to load room data', 'error')
      } finally {
        setIsLoading(false)
      }
    }

    if (params.roomId) {
      fetchRoom()
    }
  }, [params.roomId, showToast])

  const handleTaskToggle = (taskId: string) => {
    setCompletedTasks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }

  const handleCompleteSchedule = async (scheduleId: string) => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/rooms/${params.roomId}/schedules/${scheduleId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          completedTasks: Array.from(completedTasks)
        })
      })

      if (!response.ok) {
        throw new Error('Failed to complete schedule')
      }

      showToast('Schedule completed successfully', 'success')
      
      // Refresh the room data
      const [roomResponse, schedulesResponse] = await Promise.all([
        fetch(`/api/rooms/${params.roomId}`),
        fetch(`/api/rooms/${params.roomId}/schedules`)
      ])

      const roomData = await roomResponse.json()
      const schedules = await schedulesResponse.json()

      setRoom({
        ...roomData,
        schedules: schedules.map((schedule: any) => ({
          ...schedule,
          tasks: schedule.schedule.tasks.map((task: any) => ({
            id: task.id,
            description: task.description,
            completed: false
          }))
        }))
      })

      // Reset completed tasks
      setCompletedTasks(new Set())
    } catch (error) {
      console.error('Error completing schedule:', error)
      showToast('Failed to complete schedule', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Room not found</p>
          <Link
            href="/rooms"
            className="text-teal-400 hover:text-teal-300 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Rooms
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/rooms"
          className="text-gray-400 hover:text-teal-300 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">{room.name}</h1>
          <p className="text-gray-400">
            {room.type.replace('_', ' ')} • {room.floor}
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {room.schedules.map(schedule => (
          <div
            key={schedule.id}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-medium text-teal-300 mb-1">
                  {schedule.title}
                </h2>
                <div className="flex gap-3 text-sm">
                  <span className="text-gray-400">{schedule.frequency}</span>
                  <span className="text-gray-400">Next due: {new Date(schedule.nextDue).toLocaleDateString()}</span>
                </div>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs ${
                  schedule.status === 'COMPLETED'
                    ? 'bg-green-500/10 text-green-300 border-green-500/30'
                    : schedule.status === 'OVERDUE'
                    ? 'bg-red-500/10 text-red-300 border-red-500/30'
                    : schedule.status === 'IN_PROGRESS'
                    ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30'
                    : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                } border`}
              >
                {schedule.status}
              </span>
            </div>

            <div className="space-y-3">
              {schedule.tasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => handleTaskToggle(task.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded ${
                    completedTasks.has(task.id)
                      ? 'bg-teal-500/10 border-teal-500/30'
                      : 'bg-gray-900/50 border-gray-700'
                  } border hover:bg-teal-500/5 transition-colors`}
                >
                  {completedTasks.has(task.id) ? (
                    <CheckCircle2 className="w-5 h-5 text-teal-300" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                  <span className={`${completedTasks.has(task.id) ? 'text-teal-300' : 'text-gray-300'}`}>
                    {task.description}
                  </span>
                </button>
              ))}
            </div>

            {schedule.status !== 'COMPLETED' && (
              <button
                onClick={() => handleCompleteSchedule(schedule.id)}
                disabled={isSubmitting || completedTasks.size === 0}
                className="mt-6 w-full py-2 bg-teal-500/10 hover:bg-teal-500/20 disabled:hover:bg-teal-500/10 text-teal-300 disabled:text-teal-300/50 rounded border border-teal-500/30 disabled:border-teal-500/20 transition-colors disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Completing...' : 'Mark Schedule as Complete'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
} 