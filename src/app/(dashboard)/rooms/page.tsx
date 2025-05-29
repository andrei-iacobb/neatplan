"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/ui/toast-context'
import { Loader2, Plus, X, Trash2, Building2, Bed, Calendar, Layers } from 'lucide-react'
import { ScheduleFrequency, ScheduleStatus } from '@/types/schedule'
import { getFrequencyLabel } from '@/lib/schedule-utils'

interface Room {
  id: string
  name: string
  description?: string
  floor?: string
  type: string
  createdAt: string
  updatedAt: string
  schedules?: RoomSchedule[]
}

interface Schedule {
  id: string
  title: string
  tasks: { id: string; description: string }[]
}

interface RoomSchedule {
  id: string
  frequency: ScheduleFrequency
  nextDue: string
  status: ScheduleStatus
  schedule: {
    id: string
    title: string
    tasks: any[]
  }
}

type ViewMode = 'BEDROOMS' | 'OTHER_ROOMS' | 'SCHEDULES'
type AssignMode = 'QUICK' | 'MANUAL'

export default function RoomsPage() {
  const { showToast } = useToast()
  const [rooms, setRooms] = useState<Room[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedFloor, setSelectedFloor] = useState<string>('Ground Floor')
  const [viewMode, setViewMode] = useState<ViewMode>('BEDROOMS')
  const [assignMode, setAssignMode] = useState<AssignMode>('QUICK')
  const [selectedSchedule, setSelectedSchedule] = useState<string>('')
  const [selectedFrequency, setSelectedFrequency] = useState<ScheduleFrequency>(ScheduleFrequency.WEEKLY)
  const [selectedRoomType, setSelectedRoomType] = useState<string>('BEDROOM')
  const [isAssigning, setIsAssigning] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    floor: 'Ground Floor',
    type: 'BEDROOM'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/rooms').then(res => res.json()),
      fetch('/api/schedules').then(res => res.json())
    ]).then(([roomsData, schedulesData]) => {
      // Fetch schedules for each room
      Promise.all(
        roomsData.map((room: Room) =>
          fetch(`/api/rooms/${room.id}/schedules`)
            .then(res => res.json())
            .then(schedules => ({
              ...room,
              schedules
            }))
        )
      ).then(roomsWithSchedules => {
        setRooms(roomsWithSchedules)
        setSchedules(schedulesData)
        setIsLoading(false)
      })
    }).catch(error => {
      console.error('Error fetching data:', error)
      showToast('Failed to load data', 'error')
      setIsLoading(false)
    })
  }, [showToast])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) throw new Error('Failed to create room')

      const newRoom = await res.json()
      setRooms(prev => [...prev, newRoom])
      setShowForm(false)
      setFormData({ name: '', description: '', floor: 'Ground Floor', type: 'BEDROOM' })
      showToast('Room created successfully', 'success')
    } catch (error) {
      console.error('Error creating room:', error)
      showToast('Failed to create room', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedRoom) return
    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/rooms/${selectedRoom.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) throw new Error('Failed to update room')

      const updatedRoom = await res.json()
      setRooms(prev => prev.map(room => room.id === selectedRoom.id ? updatedRoom : room))
      setShowEditModal(false)
      setSelectedRoom(null)
      showToast('Room updated successfully', 'success')
    } catch (error) {
      console.error('Error updating room:', error)
      showToast('Failed to update room', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!selectedRoom) return
    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/rooms/${selectedRoom.id}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Failed to delete room')

      setRooms(prev => prev.filter(room => room.id !== selectedRoom.id))
      setShowEditModal(false)
      setSelectedRoom(null)
      showToast('Room deleted successfully', 'success')
    } catch (error) {
      console.error('Error deleting room:', error)
      showToast('Failed to delete room', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleQuickAssign() {
    if (!selectedSchedule || !selectedRoomType || !selectedFrequency) return

    setIsAssigning(true)
    try {
      // Get all rooms of selected type
      const targetRooms = rooms.filter(room => room.type === selectedRoomType)
      
      // Assign schedule to each room
      await Promise.all(
        targetRooms.map(room =>
          fetch(`/api/rooms/${room.id}/schedules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scheduleId: selectedSchedule,
              frequency: selectedFrequency
            })
          })
        )
      )

      showToast(`Schedule assigned to all ${selectedRoomType.toLowerCase()}s`, 'success')
      setSelectedSchedule('')
    } catch (error) {
      console.error('Error assigning schedules:', error)
      showToast('Failed to assign schedules', 'error')
    } finally {
      setIsAssigning(false)
    }
  }

  async function handleManualAssign() {
    if (!selectedSchedule || !selectedRoom || !selectedFrequency) return

    setIsAssigning(true)
    try {
      const response = await fetch(`/api/rooms/${selectedRoom.id}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: selectedSchedule,
          frequency: selectedFrequency
        })
      })

      if (!response.ok) throw new Error('Failed to assign schedule')

      showToast('Schedule assigned successfully', 'success')
      setSelectedSchedule('')
      setSelectedRoom(null)
    } catch (error) {
      console.error('Error assigning schedule:', error)
      showToast('Failed to assign schedule', 'error')
    } finally {
      setIsAssigning(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const bedrooms = rooms.filter(room => room.type === 'BEDROOM')
  const otherRooms = rooms.filter(room => room.type !== 'BEDROOM')
  const filteredBedrooms = bedrooms.filter(room => room.floor === selectedFloor)
  const floors = Array.from(new Set(bedrooms.map(room => room.floor))).filter(Boolean)
  const roomTypes = Array.from(new Set(rooms.map(room => room.type)))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-gray-100">Rooms</h1>
          <div className="flex gap-2 ml-6">
            <button
              onClick={() => setViewMode('BEDROOMS')}
              className={`flex items-center px-3 py-1.5 rounded ${
                viewMode === 'BEDROOMS'
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-teal-500/10 hover:text-teal-300'
              } border transition-colors`}
            >
              <Bed className="w-4 h-4 mr-2" />
              Bedrooms
            </button>
            <button
              onClick={() => setViewMode('OTHER_ROOMS')}
              className={`flex items-center px-3 py-1.5 rounded ${
                viewMode === 'OTHER_ROOMS'
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-teal-500/10 hover:text-teal-300'
              } border transition-colors`}
            >
              <Building2 className="w-4 h-4 mr-2" />
              Other Rooms
            </button>
            <button
              onClick={() => setViewMode('SCHEDULES')}
              className={`flex items-center px-3 py-1.5 rounded ${
                viewMode === 'SCHEDULES'
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-teal-500/10 hover:text-teal-300'
              } border transition-colors`}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Schedules
            </button>
          </div>
          {viewMode === 'BEDROOMS' && (
            <div className="flex gap-2 ml-6 border-l border-gray-700 pl-6">
              {floors.map(floor => (
                <button
                  key={floor}
                  onClick={() => setSelectedFloor(floor!)}
                  className={`flex items-center px-3 py-1.5 rounded ${
                    selectedFloor === floor
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-teal-500/10 hover:text-teal-300'
                  } border transition-colors`}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  {floor}
                </button>
              ))}
            </div>
          )}
        </div>
        {viewMode !== 'SCHEDULES' && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center px-4 py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 rounded border border-teal-500/30 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Room
          </button>
        )}
      </div>

      <div className="bg-gray-800/50 rounded-lg p-6">
        {viewMode === 'SCHEDULES' ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-2">
                <button
                  onClick={() => setAssignMode('QUICK')}
                  className={`flex items-center px-3 py-1.5 rounded ${
                    assignMode === 'QUICK'
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-teal-500/10 hover:text-teal-300'
                  } border transition-colors`}
                >
                  <Layers className="w-4 h-4 mr-2" />
                  Quick Assign
                </button>
                <button
                  onClick={() => setAssignMode('MANUAL')}
                  className={`flex items-center px-3 py-1.5 rounded ${
                    assignMode === 'MANUAL'
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-teal-500/10 hover:text-teal-300'
                  } border transition-colors`}
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Manual Assign
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Schedule
                </label>
                <select
                  value={selectedSchedule}
                  onChange={(e) => setSelectedSchedule(e.target.value)}
                  className="w-full rounded-md bg-gray-900/50 border border-gray-700 text-gray-100 px-3 py-2"
                >
                  <option value="">Select a schedule</option>
                  {schedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Frequency
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

              {assignMode === 'QUICK' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Room Type
                  </label>
                  <select
                    value={selectedRoomType}
                    onChange={(e) => setSelectedRoomType(e.target.value)}
                    className="w-full rounded-md bg-gray-900/50 border border-gray-700 text-gray-100 px-3 py-2"
                  >
                    {roomTypes.map(type => (
                      <option key={type} value={type}>
                        {type.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Room
                  </label>
                  <select
                    value={selectedRoom?.id || ''}
                    onChange={(e) => {
                      const roomId = e.target.value
                      setSelectedRoom(roomId ? rooms.find(r => r.id === roomId) || null : null)
                    }}
                    className="w-full rounded-md bg-gray-900/50 border border-gray-700 text-gray-100 px-3 py-2"
                  >
                    <option value="">Select a room</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name} ({room.type.replace('_', ' ')})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              onClick={assignMode === 'QUICK' ? handleQuickAssign : handleManualAssign}
              disabled={isAssigning || !selectedSchedule || (assignMode === 'QUICK' ? !selectedRoomType : !selectedRoom)}
              className="mt-6 px-4 py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 rounded border border-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAssigning ? 'Assigning...' : `Assign Schedule${assignMode === 'QUICK' ? ' to All' : ''}`}
            </button>

            {assignMode === 'QUICK' && selectedRoomType && (
              <div className="mt-4 text-sm text-gray-400">
                This will assign the selected schedule to all {rooms.filter(r => r.type === selectedRoomType).length} {selectedRoomType.toLowerCase()}s
              </div>
            )}
          </>
        ) : viewMode === 'BEDROOMS' ? (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4">
              {filteredBedrooms
                .sort((a, b) => {
                  const aNum = parseInt(a.name.split(' ')[1])
                  const bNum = parseInt(b.name.split(' ')[1])
                  return aNum - bNum
                })
                .map(room => (
                  <div
                    key={room.id}
                    className="relative rounded-lg p-4 cursor-pointer bg-gray-900/50 border border-gray-700 hover:border-teal-500/50 hover:bg-teal-500/10 transition-colors"
                  >
                    <Link href={`/rooms/${room.id}`} className="block">
                      <div className="flex flex-col h-full">
                        <div>
                          <div className="text-2xl font-light text-teal-300">
                            Room {parseInt(room.name.split(' ')[1])}
                          </div>
                          <div className="text-xs text-gray-400">
                            {room.floor}
                          </div>
                        </div>
                        {room.description && (
                          <div className="text-xs text-gray-400 truncate mt-1">
                            {room.description}
                          </div>
                        )}
                        {room.schedules && room.schedules.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <div className="text-xs font-medium text-gray-300">Schedules:</div>
                            {room.schedules.map(schedule => (
                              <div
                                key={schedule.id}
                                className="text-xs bg-gray-800/50 rounded p-2 border border-gray-700"
                              >
                                <div className="font-medium text-teal-300">
                                  {schedule.schedule.title}
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <div className="text-gray-400">
                                    {getFrequencyLabel(schedule.frequency)}
                                  </div>
                                  <span
                                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                      schedule.status === 'COMPLETED'
                                        ? 'bg-green-500/10 text-green-300'
                                        : schedule.status === 'OVERDUE'
                                        ? 'bg-red-500/10 text-red-300'
                                        : 'bg-yellow-500/10 text-yellow-300'
                                    }`}
                                  >
                                    {schedule.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  </div>
                ))}
            </div>
            {filteredBedrooms.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-400">No bedrooms on this floor.</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6">
              {otherRooms
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(room => (
                  <div
                    key={room.id}
                    className="relative rounded-lg p-4 cursor-pointer bg-gray-900/50 border border-gray-700 hover:border-teal-500/50 hover:bg-teal-500/10 transition-colors"
                  >
                    <Link href={`/rooms/${room.id}`} className="block">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-lg font-medium text-teal-300">
                              {room.name}
                            </div>
                            <div className="text-sm text-gray-400">
                              {room.type.replace('_', ' ')}
                            </div>
                          </div>
                          {room.floor && (
                            <div className="text-xs text-gray-400 bg-gray-900/50 px-2 py-1 rounded">
                              {room.floor}
                            </div>
                          )}
                        </div>
                        {room.description && (
                          <div className="text-sm text-gray-400">
                            {room.description}
                          </div>
                        )}
                        {room.schedules && room.schedules.length > 0 && (
                          <div className="mt-2 space-y-2">
                            <div className="text-xs font-medium text-gray-300">Schedules:</div>
                            {room.schedules.map(schedule => (
                              <div
                                key={schedule.id}
                                className="text-xs bg-gray-800/50 rounded p-2 border border-gray-700"
                              >
                                <div className="font-medium text-teal-300">
                                  {schedule.schedule.title}
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <div className="text-gray-400">
                                    {getFrequencyLabel(schedule.frequency)}
                                  </div>
                                  <span
                                    className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                      schedule.status === 'COMPLETED'
                                        ? 'bg-green-500/10 text-green-300'
                                        : schedule.status === 'OVERDUE'
                                        ? 'bg-red-500/10 text-red-300'
                                        : 'bg-yellow-500/10 text-yellow-300'
                                    }`}
                                  >
                                    {schedule.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  </div>
                ))}
            </div>
            {otherRooms.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-400">No other rooms added yet.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Room Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-lg p-6 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-teal-300">Add New Room</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-teal-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                    placeholder="e.g., Room 101"
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
                  placeholder="Add any additional details about the room..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-400 hover:text-teal-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 rounded border border-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Adding...' : 'Add Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Room Modal */}
      {showEditModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-lg p-6 w-full max-w-lg mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-teal-300">Edit Room</h2>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedRoom(null)
                }}
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
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedRoom(null)
                    }}
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