'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/toast-context'
import { Loader2, Calendar, CheckCircle2, X, Trash2, Building2, Pencil } from 'lucide-react'
import { ScheduleFrequency, ScheduleStatus, type RoomSchedule } from '@/types/schedule'
import { getFrequencyLabel, getScheduleDisplayName } from '@/lib/schedule-utils'

interface Room {
  id: string
  name: string
  description?: string
  floor?: string
  type: string
}

interface Schedule {
  id: string
  title: string
  detectedFrequency?: string
  suggestedFrequency?: ScheduleFrequency
  tasks: { id: string; description: string }[]
}

export default function RoomDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()
  const [room, setRoom] = useState<Room | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [roomSchedules, setRoomSchedules] = useState<RoomSchedule[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<string>('')
  const [selectedFrequency, setSelectedFrequency] = useState<ScheduleFrequency>(ScheduleFrequency.WEEKLY)
  const [isLoading, setIsLoading] = useState(true)
  const [isAssigning, setIsAssigning] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    floor: 'Ground Floor',
    type: 'BEDROOM'
  })

  useEffect(() => {
    Promise.all([
      fetch(`/api/rooms/${params.id}`).then(res => res.json()),
      fetch('/api/schedules').then(res => res.json()),
      fetch(`/api/rooms/${params.id}/schedules`).then(res => res.json())
    ]).then(([roomData, schedulesData, roomSchedulesData]) => {
      setRoom(roomData)
      setFormData({
        name: roomData.name,
        description: roomData.description || '',
        floor: roomData.floor || 'Ground Floor',
        type: roomData.type
      })
      setSchedules(schedulesData)
      setRoomSchedules(roomSchedulesData)
      setIsLoading(false)
    }).catch(error => {
      console.error('Error fetching data:', error)
      showToast('Failed to load room data', 'error')
      setIsLoading(false)
    })
  }, [params.id, showToast])

  // Add handler for schedule selection that sets suggested frequency
  const handleScheduleSelection = (scheduleId: string) => {
    setSelectedSchedule(scheduleId)
    
    if (scheduleId) {
      const schedule = schedules.find(s => s.id === scheduleId)
      if (schedule?.suggestedFrequency) {
        setSelectedFrequency(schedule.suggestedFrequency)
      }
    }
  }

  async function assignSchedule() {
    if (!selectedSchedule) return

    setIsAssigning(true)
    try {
      const response = await fetch(`/api/rooms/${params.id}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: selectedSchedule,
          frequency: selectedFrequency // This can be undefined now, API will use suggested frequency
        })
      })

      if (!response.ok) throw new Error('Failed to assign schedule')

      const newRoomSchedule = await response.json()
      setRoomSchedules(prev => [...prev, newRoomSchedule])
      showToast('Schedule assigned successfully', 'success')
      setSelectedSchedule('')
      setSelectedFrequency(ScheduleFrequency.WEEKLY) // Reset to default
    } catch (error) {
      console.error('Error assigning schedule:', error)
      showToast('Failed to assign schedule', 'error')
    } finally {
      setIsAssigning(false)
    }
  }

  async function completeSchedule(roomScheduleId: string) {
    setIsCompleting(true)
    try {
      const response = await fetch(`/api/rooms/${params.id}/schedules/${roomScheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: '' })
      })

      if (!response.ok) throw new Error('Failed to complete schedule')

      const updatedSchedule = await response.json()
      setRoomSchedules(prev =>
        prev.map(schedule =>
          schedule.id === roomScheduleId ? updatedSchedule : schedule
        )
      )
      showToast('Schedule marked as completed', 'success')
    } catch (error) {
      console.error('Error completing schedule:', error)
      showToast('Failed to mark schedule as completed', 'error')
    } finally {
      setIsCompleting(false)
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!room) return
    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) throw new Error('Failed to update room')

      const updatedRoom = await res.json()
      setRoom(updatedRoom)
      setShowEditModal(false)
      showToast('Room updated successfully', 'success')
    } catch (error) {
      console.error('Error updating room:', error)
      showToast('Failed to update room', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!room) return
    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/rooms/${room.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Failed to delete room')

      showToast('Room deleted successfully', 'success')
      router.push('/rooms')
    } catch (error) {
      console.error('Error deleting room:', error)
      showToast('Failed to delete room', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!room) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Room not found</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">{room.name}</h1>
          {room.description && (
            <p className="mt-2 text-gray-400">{room.description}</p>
          )}
          <div className="mt-4 flex items-center gap-4 text-sm text-gray-400">
            {room.floor && <span>Floor: {room.floor}</span>}
            <span>Type: {room.type}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 rounded border border-teal-500/30"
          >
            <Pencil className="w-4 h-4 mr-2" />
            Edit Room
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Assign New Schedule Section */}
        <div className="bg-gray-800/50 rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-100 mb-4">Assign New Schedule</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Schedule
              </label>
              <select
                value={selectedSchedule}
                onChange={(e) => handleScheduleSelection(e.target.value)}
                className="w-full rounded-md bg-gray-900/50 border border-gray-700 text-gray-100 px-3 py-2"
              >
                <option value="">Select a schedule</option>
                {schedules.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {schedule.title}
                    {schedule.detectedFrequency && ' ✨ (AI-detected)'}
                  </option>
                ))}
              </select>
              {selectedSchedule && schedules.find(s => s.id === selectedSchedule)?.detectedFrequency && (
                <p className="mt-1 text-xs text-teal-400">
                  ✨ AI detected frequency: "{schedules.find(s => s.id === selectedSchedule)?.detectedFrequency}"
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Frequency
                {selectedSchedule && schedules.find(s => s.id === selectedSchedule)?.suggestedFrequency && (
                  <span className="ml-2 text-xs text-teal-400">(Auto-selected from AI detection)</span>
                )}
              </label>
              <select
                value={selectedFrequency}
                onChange={(e) => setSelectedFrequency(e.target.value as ScheduleFrequency)}
                className="w-full rounded-md bg-gray-900/50 border border-gray-700 text-gray-100 px-3 py-2"
              >
                {Object.values(ScheduleFrequency).map((freq) => (
                  <option key={freq} value={freq}>
                    {getFrequencyLabel(freq as ScheduleFrequency)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={assignSchedule}
            disabled={!selectedSchedule || isAssigning}
            className="mt-4 px-4 py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 rounded-md border border-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAssigning ? 'Assigning...' : 'Assign Schedule'}
          </button>
        </div>

        {/* Assigned Schedules Section */}
        <div className="bg-gray-800/50 rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-100 mb-4">Assigned Schedules</h2>
          <div className="space-y-4">
            {roomSchedules.length === 0 ? (
              <p className="text-gray-400">No schedules assigned yet.</p>
            ) : (
              roomSchedules.map((roomSchedule) => (
                <div
                  key={roomSchedule.id}
                  className="flex items-center justify-between bg-gray-900/50 rounded-lg p-4 border border-gray-700"
                >
                  <div>
                    <h3 className="text-gray-100 font-medium">
                      {getScheduleDisplayName(roomSchedule.schedule.title, roomSchedule.frequency)}
                    </h3>
                    <div className="mt-1 text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {getFrequencyLabel(roomSchedule.frequency)}
                      </div>
                      <div className="mt-1">
                        Next due: {new Date(roomSchedule.nextDue).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        roomSchedule.status === ScheduleStatus.COMPLETED
                          ? 'bg-green-500/10 text-green-300'
                          : roomSchedule.status === ScheduleStatus.OVERDUE
                          ? 'bg-red-500/10 text-red-300'
                          : 'bg-yellow-500/10 text-yellow-300'
                      }`}
                    >
                      {roomSchedule.status}
                    </span>
                    {roomSchedule.status !== ScheduleStatus.COMPLETED && (
                      <button
                        onClick={() => completeSchedule(roomSchedule.id)}
                        disabled={isCompleting}
                        className="flex items-center gap-1 px-3 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-300 rounded-md border border-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Complete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Edit Room Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-lg p-6 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-teal-300">Edit Room</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-teal-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Room Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-md bg-gray-900/50 border border-gray-700 text-gray-100 px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Floor
                  </label>
                  <select
                    value={formData.floor}
                    onChange={e => setFormData(prev => ({ ...prev, floor: e.target.value }))}
                    className="w-full rounded-md bg-gray-900/50 border border-gray-700 text-gray-100 px-3 py-2"
                  >
                    <option value="Ground Floor">Ground Floor</option>
                    <option value="First Floor">First Floor</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Room Type
                </label>
                <select
                  value={formData.type}
                  onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full rounded-md bg-gray-900/50 border border-gray-700 text-gray-100 px-3 py-2"
                >
                  <option value="BEDROOM">Bedroom</option>
                  <option value="OFFICE">Office</option>
                  <option value="MEETING_ROOM">Meeting Room</option>
                  <option value="BATHROOM">Bathroom</option>
                  <option value="KITCHEN">Kitchen</option>
                  <option value="LOBBY">Lobby</option>
                  <option value="STORAGE">Storage</option>
                  <option value="LOUNGE">Lounge</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-md bg-gray-900/50 border border-gray-700 text-gray-100 px-3 py-2"
                  rows={3}
                />
              </div>

              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 rounded border border-red-500/30"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Room
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 text-gray-400 hover:text-teal-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 rounded border border-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
} 