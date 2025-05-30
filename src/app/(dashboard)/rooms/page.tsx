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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-teal-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading rooms...</p>
        </div>
      </div>
    )
  }

  const bedrooms = rooms.filter(room => room.type === 'BEDROOM')
  const otherRooms = rooms.filter(room => room.type !== 'BEDROOM')
  const filteredBedrooms = bedrooms.filter(room => room.floor === selectedFloor)
  const floors = Array.from(new Set(bedrooms.map(room => room.floor))).filter(Boolean)
  const roomTypes = Array.from(new Set(rooms.map(room => room.type)))

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Room Management</h1>
          <p className="text-gray-400">Manage your facility's rooms and their cleaning configurations</p>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <div className="flex gap-2">
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

        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
          {viewMode === 'BEDROOMS' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-100 mb-4">
                Bedrooms - {selectedFloor} ({filteredBedrooms.length} rooms)
              </h2>
              {filteredBedrooms.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No bedrooms found on this floor</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredBedrooms.map((room) => (
                    <RoomCard key={room.id} room={room} onEdit={(room) => {
                      setSelectedRoom(room)
                      setFormData({
                        name: room.name,
                        description: room.description || '',
                        floor: room.floor || 'Ground Floor',
                        type: room.type
                      })
                      setShowEditModal(true)
                    }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === 'OTHER_ROOMS' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-100 mb-4">
                Other Rooms ({otherRooms.length} rooms)
              </h2>
              {otherRooms.length === 0 ? (
                <div className="text-center py-8">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No other rooms found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {otherRooms.map((room) => (
                    <RoomCard key={room.id} room={room} onEdit={(room) => {
                      setSelectedRoom(room)
                      setFormData({
                        name: room.name,
                        description: room.description || '',
                        floor: room.floor || 'Ground Floor',
                        type: room.type
                      })
                      setShowEditModal(true)
                    }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === 'SCHEDULES' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-100 mb-6">Schedule Assignment</h2>
              
              {/* Assignment Mode Toggle */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setAssignMode('QUICK')}
                  className={`px-4 py-2 rounded ${
                    assignMode === 'QUICK'
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-teal-500/10 hover:text-teal-300'
                  } border transition-colors`}
                >
                  Quick Assign
                </button>
                <button
                  onClick={() => setAssignMode('MANUAL')}
                  className={`px-4 py-2 rounded ${
                    assignMode === 'MANUAL'
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-teal-500/10 hover:text-teal-300'
                  } border transition-colors`}
                >
                  Manual Assign
                </button>
              </div>

              {assignMode === 'QUICK' && (
                <div className="bg-gray-900/50 rounded-lg border border-gray-600 p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-100 mb-4">Quick Assignment</h3>
                  <p className="text-gray-400 mb-4">Assign a schedule to all rooms of a specific type</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Schedule</label>
                      <select
                        value={selectedSchedule}
                        onChange={(e) => setSelectedSchedule(e.target.value)}
                        className="w-full rounded-md bg-gray-800 border border-gray-600 text-gray-100 px-3 py-2"
                      >
                        <option value="">Select schedule...</option>
                        {schedules.map((schedule) => (
                          <option key={schedule.id} value={schedule.id}>
                            {schedule.title} ({schedule.tasks.length} tasks)
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Room Type</label>
                      <select
                        value={selectedRoomType}
                        onChange={(e) => setSelectedRoomType(e.target.value)}
                        className="w-full rounded-md bg-gray-800 border border-gray-600 text-gray-100 px-3 py-2"
                      >
                        {roomTypes.map((type) => (
                          <option key={type} value={type}>
                            {type.replace('_', ' ')} ({rooms.filter(r => r.type === type).length} rooms)
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Frequency</label>
                      <select
                        value={selectedFrequency}
                        onChange={(e) => setSelectedFrequency(e.target.value as ScheduleFrequency)}
                        className="w-full rounded-md bg-gray-800 border border-gray-600 text-gray-100 px-3 py-2"
                      >
                        {Object.values(ScheduleFrequency).map((freq) => (
                          <option key={freq} value={freq}>
                            {getFrequencyLabel(freq)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleQuickAssign}
                    disabled={!selectedSchedule || !selectedRoomType || isAssigning}
                    className="flex items-center px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded border border-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAssigning ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Assign to All {selectedRoomType.replace('_', ' ')}s
                  </button>
                </div>
              )}

              {assignMode === 'MANUAL' && (
                <div className="bg-gray-900/50 rounded-lg border border-gray-600 p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-100 mb-4">Manual Assignment</h3>
                  <p className="text-gray-400 mb-4">Assign a schedule to a specific room</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Schedule</label>
                      <select
                        value={selectedSchedule}
                        onChange={(e) => setSelectedSchedule(e.target.value)}
                        className="w-full rounded-md bg-gray-800 border border-gray-600 text-gray-100 px-3 py-2"
                      >
                        <option value="">Select schedule...</option>
                        {schedules.map((schedule) => (
                          <option key={schedule.id} value={schedule.id}>
                            {schedule.title} ({schedule.tasks.length} tasks)
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Room</label>
                      <select
                        value={selectedRoom?.id || ''}
                        onChange={(e) => {
                          const room = rooms.find(r => r.id === e.target.value)
                          setSelectedRoom(room || null)
                        }}
                        className="w-full rounded-md bg-gray-800 border border-gray-600 text-gray-100 px-3 py-2"
                      >
                        <option value="">Select room...</option>
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.name} ({room.type.replace('_', ' ')})
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Frequency</label>
                      <select
                        value={selectedFrequency}
                        onChange={(e) => setSelectedFrequency(e.target.value as ScheduleFrequency)}
                        className="w-full rounded-md bg-gray-800 border border-gray-600 text-gray-100 px-3 py-2"
                      >
                        {Object.values(ScheduleFrequency).map((freq) => (
                          <option key={freq} value={freq}>
                            {getFrequencyLabel(freq)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleManualAssign}
                    disabled={!selectedSchedule || !selectedRoom || isAssigning}
                    className="flex items-center px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded border border-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAssigning ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Assign Schedule
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add Room Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-100">Add New Room</h2>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-400 hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Room Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-md bg-gray-900/50 border border-gray-700 text-gray-100 px-3 py-2"
                    placeholder="e.g., Room 52"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Floor
                  </label>
                  <select
                    value={formData.floor}
                    onChange={(e) => setFormData(prev => ({ ...prev, floor: e.target.value }))}
                    className="w-full rounded-md bg-gray-900/50 border border-gray-700 text-gray-100 px-3 py-2"
                  >
                    <option value="Ground Floor">Ground Floor</option>
                    <option value="Upstairs">Upstairs</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Room Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
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
                    Description (Optional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full rounded-md bg-gray-900/50 border border-gray-700 text-gray-100 px-3 py-2"
                    rows={3}
                    placeholder="Room description..."
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded border border-teal-500/50 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Create Room'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-gray-400 hover:text-gray-300 border border-gray-600 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Room Modal */}
        {showEditModal && selectedRoom && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-100">Edit Room</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedRoom(null)
                  }}
                  className="text-gray-400 hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleEdit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Room Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-md bg-gray-900/50 border border-gray-700 text-gray-100 px-3 py-2"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Floor
                  </label>
                  <select
                    value={formData.floor}
                    onChange={(e) => setFormData(prev => ({ ...prev, floor: e.target.value }))}
                    className="w-full rounded-md bg-gray-900/50 border border-gray-700 text-gray-100 px-3 py-2"
                  >
                    <option value="Ground Floor">Ground Floor</option>
                    <option value="Upstairs">Upstairs</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Room Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full rounded-md bg-gray-900/50 border border-gray-700 text-gray-100 px-3 py-2"
                    rows={3}
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded border border-teal-500/50 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Update Room'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-red-400 hover:text-red-300 border border-red-500/50 rounded disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedRoom(null)
                    }}
                    className="px-4 py-2 text-gray-400 hover:text-gray-300 border border-gray-600 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Room Card Component
interface RoomCardProps {
  room: Room
  onEdit: (room: Room) => void
}

function RoomCard({ room, onEdit }: RoomCardProps) {
  const getRoomTypeIcon = (type: string) => {
    switch (type) {
      case 'BEDROOM': return '🛏️'
      case 'BATHROOM': return '🚿'
      case 'KITCHEN': return '🍳'
      case 'OFFICE': return '💼'
      case 'MEETING_ROOM': return '🪑'
      case 'LOBBY': return '🏢'
      case 'STORAGE': return '📦'
      case 'LOUNGE': return '🛋️'
      default: return '🏠'
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'OVERDUE': return 'text-red-400 bg-red-400/10 border-red-400/20'
      case 'PENDING': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
      case 'COMPLETED': return 'text-green-400 bg-green-400/10 border-green-400/20'
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    }
  }

  const activeSchedules = room.schedules?.filter(s => s.status !== 'COMPLETED') || []
  const completedSchedules = room.schedules?.filter(s => s.status === 'COMPLETED') || []

  return (
    <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-4 hover:border-gray-500 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getRoomTypeIcon(room.type)}</span>
          <div>
            <h3 className="font-semibold text-gray-100">{room.name}</h3>
            <p className="text-sm text-gray-400">{room.floor}</p>
          </div>
        </div>
        <button
          onClick={() => onEdit(room)}
          className="text-gray-400 hover:text-teal-300 transition-colors"
        >
          <Layers className="w-4 h-4" />
        </button>
      </div>

      {room.description && (
        <p className="text-sm text-gray-400 mb-3">{room.description}</p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-300">Active Schedules:</span>
          <span className="text-gray-100">{activeSchedules.length}</span>
        </div>
        
        {activeSchedules.length > 0 && (
          <div className="space-y-1">
            {activeSchedules.slice(0, 2).map((schedule) => (
              <div key={schedule.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-400 truncate">{schedule.schedule.title}</span>
                <span className={`px-2 py-0.5 rounded border ${getStatusColor(schedule.status)}`}>
                  {schedule.status}
                </span>
              </div>
            ))}
            {activeSchedules.length > 2 && (
              <p className="text-xs text-gray-500">+{activeSchedules.length - 2} more</p>
            )}
          </div>
        )}

        {completedSchedules.length > 0 && (
          <div className="text-xs text-gray-500">
            {completedSchedules.length} completed schedule{completedSchedules.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-700">
        <Link
          href={`/rooms/${room.id}`}
          className="text-sm text-teal-400 hover:text-teal-300 transition-colors"
        >
          View Details →
        </Link>
      </div>
    </div>
  )
} 