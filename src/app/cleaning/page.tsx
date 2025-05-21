"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface CleaningTask {
  id: string
  taskDescription: string
  frequency: string
  estimatedDuration: string
  status: string
  roomId?: string
}

interface Room {
  id: string
  name: string
}

export default function CleaningPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tasks, setTasks] = useState<CleaningTask[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedRoomForTask, setSelectedRoomForTask] = useState<string>("")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/")
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchRooms()
      fetchTasks()
    }
  }, [session])

  async function fetchRooms() {
    try {
      const response = await fetch('/api/rooms')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setRooms(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rooms')
    }
  }

  async function fetchTasks() {
    try {
      const response = await fetch('/api/cleaning-tasks')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setTasks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks')
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.length) return

    const file = event.target.files[0]
    const formData = new FormData()
    formData.append('file', file)

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/process-document', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process document')
      }

      // Refresh tasks list
      fetchTasks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process document')
    } finally {
      setIsLoading(false)
    }
  }

  async function assignTaskToRoom(taskId: string, roomId: string) {
    try {
      const response = await fetch(`/api/cleaning-tasks/${taskId}/assign-room`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign task to room')
      }

      // Refresh tasks list
      fetchTasks()
      setSelectedTaskId(null)
      setSelectedRoomForTask("")
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign task to room')
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-teal-400 text-lg font-light">Loading...</p>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-100">Cleaning Schedule</h1>
          <div className="flex space-x-3">
            <label className="px-4 py-2 bg-teal-500/10 text-teal-300 rounded-md border border-teal-500/30 hover:bg-teal-500/20 transition-colors cursor-pointer">
              Upload Schedule
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                disabled={isLoading}
              />
            </label>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {tasks.map((task) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 rounded-lg bg-black/20 backdrop-blur-sm border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-medium text-gray-100">{task.taskDescription}</h3>
                    <span className="px-2 py-1 rounded text-xs border bg-teal-500/10 text-teal-300 border-teal-500/30">
                      {task.frequency}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                    <div>
                      <span className="block text-gray-500">Duration</span>
                      {task.estimatedDuration}
                    </div>
                    <div>
                      <span className="block text-gray-500">Status</span>
                      {task.status}
                    </div>
                  </div>
                  {task.roomId ? (
                    <div className="mt-2">
                      <span className="text-sm text-gray-500">Assigned to room: </span>
                      <span className="text-sm text-gray-300">
                        {rooms.find(room => room.id === task.roomId)?.name || 'Unknown Room'}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center space-x-2">
                      <select
                        value={selectedTaskId === task.id ? selectedRoomForTask : ""}
                        onChange={(e) => {
                          setSelectedTaskId(task.id)
                          setSelectedRoomForTask(e.target.value)
                        }}
                        className="px-2 py-1 bg-white/5 text-gray-300 rounded-md border border-white/10 hover:bg-white/10 transition-colors text-sm"
                      >
                        <option value="">Select Room</option>
                        {rooms.map(room => (
                          <option key={room.id} value={room.id}>
                            {room.name}
                          </option>
                        ))}
                      </select>
                      {selectedTaskId === task.id && selectedRoomForTask && (
                        <button
                          onClick={() => assignTaskToRoom(task.id, selectedRoomForTask)}
                          className="px-3 py-1 bg-teal-500/10 text-teal-300 rounded border border-teal-500/30 hover:bg-teal-500/20 transition-colors text-sm"
                        >
                          Assign
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex space-x-2 ml-4">
                  <button 
                    className="px-3 py-1.5 bg-teal-500/10 text-teal-300 rounded border border-teal-500/30 hover:bg-teal-500/20 transition-colors text-sm"
                    onClick={() => {
                      // TODO: Implement task completion
                    }}
                  >
                    Complete
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
} 