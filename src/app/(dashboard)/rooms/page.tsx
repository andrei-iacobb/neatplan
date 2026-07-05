"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useToast } from '@/components/ui/toast-context'
import { useThemeColors } from '@/hooks/useThemeColors'
import {
  Plus, X, Trash2, Building2, Calendar, Layers,
  BedDouble, UtensilsCrossed, Presentation, DoorOpen,
  Sofa, Archive, ArrowRight, Sparkles,
} from 'lucide-react'
import { ScheduleFrequency, ScheduleStatus } from '@prisma/client'
import { getFrequencyLabel, getScheduleDisplayName } from '@/lib/schedule-utils'
import { apiRequest } from '@/lib/url-utils'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }

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
  detectedFrequency?: string | null
  suggestedFrequency?: ScheduleFrequency | null
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
  const tc = useThemeColors()
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
      apiRequest('/api/rooms').then(res => res.json()),
      apiRequest('/api/schedules').then(res => res.json())
    ]).then(([roomsData, schedulesData]) => {
      Promise.all(
        roomsData.map((room: Room) =>
          apiRequest(`/api/rooms/${room.id}/schedules`)
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
      const res = await apiRequest('/api/rooms', {
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
      const res = await apiRequest(`/api/rooms/${selectedRoom.id}`, {
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
      const res = await apiRequest(`/api/rooms/${selectedRoom.id}`, { method: 'DELETE' })
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
      const targetRooms = rooms.filter(room => room.type === selectedRoomType)
      await Promise.all(
        targetRooms.map(room =>
          apiRequest(`/api/rooms/${room.id}/schedules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduleId: selectedSchedule, frequency: selectedFrequency })
          })
        )
      )
      showToast(`Schedule assigned to all ${selectedRoomType.toLowerCase()}s`, 'success')
      setSelectedSchedule('')
      setSelectedFrequency(ScheduleFrequency.WEEKLY)
    } catch (error) {
      console.error('Error assigning schedules:', error)
      showToast('Failed to assign schedules', 'error')
    } finally {
      setIsAssigning(false)
    }
  }

  const handleScheduleSelection = (scheduleId: string) => {
    setSelectedSchedule(scheduleId)
    if (scheduleId) {
      const schedule = schedules.find(s => s.id === scheduleId)
      if (schedule?.suggestedFrequency) {
        setSelectedFrequency(schedule.suggestedFrequency)
      }
    }
  }

  async function handleManualAssign() {
    if (!selectedSchedule || !selectedRoom || !selectedFrequency) return
    setIsAssigning(true)
    try {
      const response = await apiRequest(`/api/rooms/${selectedRoom.id}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: selectedSchedule, frequency: selectedFrequency })
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 rounded-full border-2 border-transparent" style={{ borderTopColor: 'rgb(16,185,129)', borderRightColor: 'rgba(16,185,129,0.3)' }} />
      </div>
    )
  }

  const bedrooms = rooms.filter(room => room.type === 'BEDROOM')
  const otherRooms = rooms.filter(room => room.type !== 'BEDROOM')
  const filteredBedrooms = bedrooms.filter(room => room.floor === selectedFloor)
  const floors = Array.from(new Set(bedrooms.map(room => room.floor))).filter(Boolean)
  const roomTypes = Array.from(new Set(rooms.map(room => room.type)))

  // Room-category tabs only. The Schedules view lives on the right (next to Add Room)
  // because it's a distinct view, not a room type.
  const viewTabs = [
    { mode: 'BEDROOMS' as ViewMode, icon: BedDouble, label: 'Bedrooms' },
    { mode: 'OTHER_ROOMS' as ViewMode, icon: Building2, label: 'Other Rooms' },
  ]

  return (
    <div className="max-w-[1100px] mx-auto relative z-10 pb-8">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4" style={{ color: 'rgb(16,185,129)' }} />
          <p className="text-[13px] font-medium tracking-wide uppercase" style={{ color: tc.accentLabel }}>Room Management</p>
        </div>
        <h1 className="text-[32px] font-bold tracking-tight mb-1" style={{ color: tc.textPrimary }}>Room Management</h1>
        <p className="text-[15px]" style={{ color: tc.textMuted }}>Manage your facility's rooms and their cleaning configurations</p>
      </div>

      {/* Controls */}
      <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.05 }} className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2">
            {viewTabs.map((tab) => (
              <button
                key={tab.mode}
                onClick={() => setViewMode(tab.mode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200"
                style={viewMode === tab.mode
                  ? { background: tc.tabActiveBg, color: tc.tabActiveText, border: `1px solid ${tc.tabActiveBorder}` }
                  : { background: tc.tabInactiveBg, color: tc.tabInactiveText, border: '1px solid transparent' }
                }
                onMouseEnter={(e) => { if (viewMode !== tab.mode) { e.currentTarget.style.background = tc.tabInactiveHoverBg; e.currentTarget.style.color = tc.tabInactiveHoverText }}}
                onMouseLeave={(e) => { if (viewMode !== tab.mode) { e.currentTarget.style.background = tc.tabInactiveBg; e.currentTarget.style.color = tc.tabInactiveText }}}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
          {viewMode === 'BEDROOMS' && floors.length > 0 && (
            <div className="flex gap-2 ml-4 pl-4" style={{ borderLeft: `1px solid ${tc.divider}` }}>
              {floors.map(floor => (
                <button
                  key={floor}
                  onClick={() => setSelectedFloor(floor!)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200"
                  style={selectedFloor === floor
                    ? { background: tc.tabActiveBg, color: tc.tabActiveText, border: `1px solid ${tc.tabActiveBorder}` }
                    : { background: tc.tabInactiveBg, color: tc.tabInactiveText, border: '1px solid transparent' }
                  }
                  onMouseEnter={(e) => { if (selectedFloor !== floor) { e.currentTarget.style.background = tc.tabInactiveHoverBg; e.currentTarget.style.color = tc.tabInactiveHoverText }}}
                  onMouseLeave={(e) => { if (selectedFloor !== floor) { e.currentTarget.style.background = tc.tabInactiveBg; e.currentTarget.style.color = tc.tabInactiveText }}}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  {floor}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('SCHEDULES')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.97]"
            style={viewMode === 'SCHEDULES'
              ? { background: tc.tabActiveBg, color: tc.tabActiveText, border: `1px solid ${tc.tabActiveBorder}` }
              : { background: tc.tabInactiveBg, color: tc.tabInactiveText, border: '1px solid transparent' }
            }
            onMouseEnter={(e) => { if (viewMode !== 'SCHEDULES') { e.currentTarget.style.background = tc.tabInactiveHoverBg; e.currentTarget.style.color = tc.tabInactiveHoverText }}}
            onMouseLeave={(e) => { if (viewMode !== 'SCHEDULES') { e.currentTarget.style.background = tc.tabInactiveBg; e.currentTarget.style.color = tc.tabInactiveText }}}
            aria-pressed={viewMode === 'SCHEDULES'}
          >
            <Calendar className="w-3.5 h-3.5" />
            Schedules
          </button>
          {viewMode !== 'SCHEDULES' && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.97]"
              style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: `1px solid ${tc.btnPrimaryBorder}` }}
              onMouseEnter={(e) => { e.currentTarget.style.background = tc.btnPrimaryHoverBg }}
              onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnPrimaryBg }}
            >
              <Plus className="w-4 h-4" />
              Add Room
            </button>
          )}
        </div>
      </motion.div>

      {/* Main Content */}
      <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.1 }}
        className="rounded-xl p-5"
        style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}>

        {viewMode === 'BEDROOMS' && (
          <div>
            <h2 className="text-[15px] font-semibold mb-4" style={{ color: tc.textPrimary }}>
              Bedrooms - {selectedFloor} ({filteredBedrooms.length} rooms)
            </h2>
            {filteredBedrooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: tc.emptyBg }}>
                  <Building2 className="w-5 h-5" style={{ color: tc.textFaint }} />
                </div>
                <p className="text-[13px] font-medium" style={{ color: tc.textMuted }}>No bedrooms found on this floor</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredBedrooms.map((room, i) => (
                  <RoomCard key={room.id} room={room} tc={tc} delay={i * 0.04} onEdit={(room) => {
                    setSelectedRoom(room)
                    setFormData({ name: room.name, description: room.description || '', floor: room.floor || 'Ground Floor', type: room.type })
                    setShowEditModal(true)
                  }} />
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode === 'OTHER_ROOMS' && (
          <div>
            <h2 className="text-[15px] font-semibold mb-4" style={{ color: tc.textPrimary }}>
              Other Rooms ({otherRooms.length} rooms)
            </h2>
            {otherRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: tc.emptyBg }}>
                  <Building2 className="w-5 h-5" style={{ color: tc.textFaint }} />
                </div>
                <p className="text-[13px] font-medium" style={{ color: tc.textMuted }}>No other rooms found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {otherRooms.map((room, i) => (
                  <RoomCard key={room.id} room={room} tc={tc} delay={i * 0.04} onEdit={(room) => {
                    setSelectedRoom(room)
                    setFormData({ name: room.name, description: room.description || '', floor: room.floor || 'Ground Floor', type: room.type })
                    setShowEditModal(true)
                  }} />
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode === 'SCHEDULES' && (
          <div>
            <h2 className="text-[15px] font-semibold mb-5" style={{ color: tc.textPrimary }}>Schedule Assignment</h2>

            {/* Assignment Mode Toggle */}
            <div className="flex gap-2 mb-5">
              {(['QUICK', 'MANUAL'] as AssignMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAssignMode(mode)}
                  className="px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200"
                  style={assignMode === mode
                    ? { background: tc.tabActiveBg, color: tc.tabActiveText, border: `1px solid ${tc.tabActiveBorder}` }
                    : { background: tc.tabInactiveBg, color: tc.tabInactiveText, border: '1px solid transparent' }
                  }
                  onMouseEnter={(e) => { if (assignMode !== mode) { e.currentTarget.style.background = tc.tabInactiveHoverBg; e.currentTarget.style.color = tc.tabInactiveHoverText }}}
                  onMouseLeave={(e) => { if (assignMode !== mode) { e.currentTarget.style.background = tc.tabInactiveBg; e.currentTarget.style.color = tc.tabInactiveText }}}
                >
                  {mode === 'QUICK' ? 'Quick Assign' : 'Manual Assign'}
                </button>
              ))}
            </div>

            {assignMode === 'QUICK' && (
              <div className="rounded-xl p-5 mb-4" style={{ background: tc.surfaceBg, border: `1px solid ${tc.cardBorder}` }}>
                <h3 className="text-[14px] font-semibold mb-1" style={{ color: tc.textPrimary }}>Quick Assignment</h3>
                <p className="text-[12px] mb-4" style={{ color: tc.textMuted }}>Assign a schedule to all rooms of a specific type</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: tc.textSecondary }}>Schedule</label>
                    <select value={selectedSchedule} onChange={(e) => handleScheduleSelection(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors"
                      style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}>
                      <option value="">Select schedule...</option>
                      {schedules.map((s) => <option key={s.id} value={s.id}>{getScheduleDisplayName(s.title)}</option>)}
                    </select>
                    {selectedSchedule && schedules.find(s => s.id === selectedSchedule)?.suggestedFrequency && (
                      <p className="mt-1 text-[11px] font-medium" style={{ color: tc.accentGreen }}>
                        AI detected: &ldquo;{schedules.find(s => s.id === selectedSchedule)?.suggestedFrequency}&rdquo;
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: tc.textSecondary }}>Room Type</label>
                    <select value={selectedRoomType} onChange={(e) => setSelectedRoomType(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors"
                      style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}>
                      {roomTypes.map((type) => (
                        <option key={type} value={type}>{type.replace('_', ' ')} ({rooms.filter(r => r.type === type).length} rooms)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: tc.textSecondary }}>
                      Frequency
                      {selectedSchedule && schedules.find(s => s.id === selectedSchedule)?.suggestedFrequency && (
                        <span className="ml-1 text-[10px]" style={{ color: tc.accentGreen }}>(AI auto-selected)</span>
                      )}
                    </label>
                    <select value={selectedFrequency} onChange={(e) => setSelectedFrequency(e.target.value as ScheduleFrequency)}
                      className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors"
                      style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}>
                      {Object.values(ScheduleFrequency).map((freq) => <option key={freq} value={freq}>{getFrequencyLabel(freq)}</option>)}
                    </select>
                  </div>
                </div>

                <button onClick={handleQuickAssign} disabled={!selectedSchedule || !selectedRoomType || isAssigning}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: `1px solid ${tc.btnPrimaryBorder}` }}
                  onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = tc.btnPrimaryHoverBg }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnPrimaryBg }}>
                  {isAssigning ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 rounded-full border-2 border-transparent" style={{ borderTopColor: tc.btnPrimaryText, borderRightColor: 'transparent' }} />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Assign to All {selectedRoomType.replace('_', ' ')}s
                </button>
              </div>
            )}

            {assignMode === 'MANUAL' && (
              <div className="rounded-xl p-5 mb-4" style={{ background: tc.surfaceBg, border: `1px solid ${tc.cardBorder}` }}>
                <h3 className="text-[14px] font-semibold mb-1" style={{ color: tc.textPrimary }}>Manual Assignment</h3>
                <p className="text-[12px] mb-4" style={{ color: tc.textMuted }}>Assign a schedule to a specific room</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: tc.textSecondary }}>Schedule</label>
                    <select value={selectedSchedule} onChange={(e) => handleScheduleSelection(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors"
                      style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}>
                      <option value="">Select schedule...</option>
                      {schedules.map((s) => <option key={s.id} value={s.id}>{getScheduleDisplayName(s.title)}</option>)}
                    </select>
                    {selectedSchedule && schedules.find(s => s.id === selectedSchedule)?.suggestedFrequency && (
                      <p className="mt-1 text-[11px] font-medium" style={{ color: tc.accentGreen }}>
                        AI detected: &ldquo;{schedules.find(s => s.id === selectedSchedule)?.suggestedFrequency}&rdquo;
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: tc.textSecondary }}>Room</label>
                    <select value={selectedRoom?.id || ''} onChange={(e) => { const room = rooms.find(r => r.id === e.target.value); setSelectedRoom(room || null) }}
                      className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors"
                      style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}>
                      <option value="">Select room...</option>
                      {rooms.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.type.replace('_', ' ')})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: tc.textSecondary }}>
                      Frequency
                      {selectedSchedule && schedules.find(s => s.id === selectedSchedule)?.suggestedFrequency && (
                        <span className="ml-1 text-[10px]" style={{ color: tc.accentGreen }}>(AI auto-selected)</span>
                      )}
                    </label>
                    <select value={selectedFrequency} onChange={(e) => setSelectedFrequency(e.target.value as ScheduleFrequency)}
                      className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors"
                      style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}>
                      {Object.values(ScheduleFrequency).map((freq) => <option key={freq} value={freq}>{getFrequencyLabel(freq)}</option>)}
                    </select>
                  </div>
                </div>

                <button onClick={handleManualAssign} disabled={!selectedSchedule || !selectedRoom || isAssigning}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: `1px solid ${tc.btnPrimaryBorder}` }}
                  onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = tc.btnPrimaryHoverBg }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnPrimaryBg }}>
                  {isAssigning ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 rounded-full border-2 border-transparent" style={{ borderTopColor: tc.btnPrimaryText, borderRightColor: 'transparent' }} />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Assign Schedule
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Add Room Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: tc.modalOverlay }}>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}
            className="rounded-xl p-6 w-full max-w-md mx-4"
            style={{ background: tc.modalBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-[16px] font-semibold" style={{ color: tc.textPrimary }}>Add New Room</h2>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                style={{ color: tc.textMuted }}
                onMouseEnter={(e) => { e.currentTarget.style.color = tc.textSecondary; e.currentTarget.style.background = tc.hoverRow }}
                onMouseLeave={(e) => { e.currentTarget.style.color = tc.textMuted; e.currentTarget.style.background = 'transparent' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="Room Name" tc={tc}>
                <input type="text" required value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors"
                  style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}
                  placeholder="e.g., Room 52" />
              </FormField>
              <FormField label="Floor" tc={tc}>
                <select value={formData.floor} onChange={(e) => setFormData(prev => ({ ...prev, floor: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors"
                  style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}>
                  <option value="Ground Floor">Ground Floor</option>
                  <option value="Upstairs">Upstairs</option>
                </select>
              </FormField>
              <FormField label="Room Type" tc={tc}>
                <RoomTypeSelect value={formData.type} onChange={(v) => setFormData(prev => ({ ...prev, type: v }))} tc={tc} />
              </FormField>
              <FormField label="Description (Optional)" tc={tc}>
                <textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors resize-none"
                  style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}
                  rows={3} placeholder="Room description..." />
              </FormField>
              <div className="flex gap-3 pt-2" style={{ borderTop: `1px solid ${tc.divider}`, paddingTop: '16px' }}>
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center px-4 py-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
                  style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: `1px solid ${tc.btnPrimaryBorder}` }}
                  onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = tc.btnPrimaryHoverBg }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnPrimaryBg }}>
                  {isSubmitting ? 'Creating...' : 'Create Room'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
                  style={{ background: tc.btnSecondaryBg, color: tc.btnSecondaryText, border: `1px solid ${tc.btnSecondaryBorder}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = tc.btnSecondaryHoverBg }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnSecondaryBg }}>
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Edit Room Modal */}
      {showEditModal && selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: tc.modalOverlay }}>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }}
            className="rounded-xl p-6 w-full max-w-md mx-4"
            style={{ background: tc.modalBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-[16px] font-semibold" style={{ color: tc.textPrimary }}>Edit Room</h2>
              <button onClick={() => { setShowEditModal(false); setSelectedRoom(null) }}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors"
                style={{ color: tc.textMuted }}
                onMouseEnter={(e) => { e.currentTarget.style.color = tc.textSecondary; e.currentTarget.style.background = tc.hoverRow }}
                onMouseLeave={(e) => { e.currentTarget.style.color = tc.textMuted; e.currentTarget.style.background = 'transparent' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <FormField label="Room Name" tc={tc}>
                <input type="text" required value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors"
                  style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }} />
              </FormField>
              <FormField label="Floor" tc={tc}>
                <select value={formData.floor} onChange={(e) => setFormData(prev => ({ ...prev, floor: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors"
                  style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}>
                  <option value="Ground Floor">Ground Floor</option>
                  <option value="Upstairs">Upstairs</option>
                </select>
              </FormField>
              <FormField label="Room Type" tc={tc}>
                <RoomTypeSelect value={formData.type} onChange={(v) => setFormData(prev => ({ ...prev, type: v }))} tc={tc} />
              </FormField>
              <FormField label="Description" tc={tc}>
                <textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors resize-none"
                  style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}
                  rows={3} />
              </FormField>
              <div className="flex gap-3 pt-2" style={{ borderTop: `1px solid ${tc.divider}`, paddingTop: '16px' }}>
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center px-4 py-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
                  style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: `1px solid ${tc.btnPrimaryBorder}` }}
                  onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = tc.btnPrimaryHoverBg }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnPrimaryBg }}>
                  {isSubmitting ? 'Saving...' : 'Update Room'}
                </button>
                <button type="button" onClick={handleDelete} disabled={isSubmitting}
                  className="px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: tc.btnDangerBg, color: tc.btnDangerText, border: `1px solid ${tc.btnDangerBorder}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = tc.btnDangerHoverBg }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnDangerBg }}>
                  <Trash2 className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => { setShowEditModal(false); setSelectedRoom(null) }}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
                  style={{ background: tc.btnSecondaryBg, color: tc.btnSecondaryText, border: `1px solid ${tc.btnSecondaryBorder}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = tc.btnSecondaryHoverBg }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnSecondaryBg }}>
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}

// Helper components
type TC = ReturnType<typeof useThemeColors>

function FormField({ label, tc, children }: { label: string; tc: TC; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-medium mb-1.5" style={{ color: tc.textSecondary }}>{label}</label>
      {children}
    </div>
  )
}

function RoomTypeSelect({ value, onChange, tc }: { value: string; onChange: (v: string) => void; tc: TC }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors"
      style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}>
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
  )
}

function getRoomTypeIcon(type: string) {
  const c = "w-[18px] h-[18px]"
  switch (type) {
    case 'BEDROOM': return <BedDouble className={c} />
    case 'OFFICE': return <Building2 className={c} />
    case 'KITCHEN': return <UtensilsCrossed className={c} />
    case 'MEETING_ROOM': return <Presentation className={c} />
    case 'LOUNGE': return <Sofa className={c} />
    case 'STORAGE': return <Archive className={c} />
    default: return <DoorOpen className={c} />
  }
}

function getComputedStatus(schedule: RoomSchedule): string {
  if (schedule.status === 'COMPLETED') return 'COMPLETED'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDate = new Date(schedule.nextDue)
  dueDate.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'OVERDUE'
  if (diffDays <= 2) return 'PENDING'
  return 'SCHEDULED'
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'OVERDUE': return 'Overdue'
    case 'PENDING': return 'Due Soon'
    case 'COMPLETED': return 'Completed'
    case 'SCHEDULED': return 'Scheduled'
    default: return status
  }
}

function getStatusStyle(status: string, tc: TC) {
  switch (status) {
    case 'OVERDUE': return tc.statusOverdue
    case 'COMPLETED': return tc.statusCompleted
    case 'PENDING': return tc.statusPending
    case 'SCHEDULED': return { bg: tc.emptyBg, text: tc.textMuted, border: tc.cardBorder }
    default: return { bg: tc.emptyBg, text: tc.textMuted, border: tc.cardBorder }
  }
}

interface RoomCardProps {
  room: Room
  tc: TC
  delay: number
  onEdit: (room: Room) => void
}

function RoomCard({ room, tc, delay, onEdit }: RoomCardProps) {
  const activeSchedules = room.schedules?.filter(s => s.status !== 'COMPLETED') || []
  const completedSchedules = room.schedules?.filter(s => s.status === 'COMPLETED') || []
  const accent = tc.accentGreen

  return (
    <motion.div {...fadeUp} transition={{ duration: 0.3, delay: 0.15 + delay }} className="h-full">
      <Link href={`/rooms/${room.id}`}
        className="group block h-full rounded-xl p-4 transition-all duration-200 relative overflow-hidden"
        style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = tc.cardHoverBorder(accent); e.currentTarget.style.background = tc.cardHoverBg }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = tc.cardBorder; e.currentTarget.style.background = tc.cardBg }}>
      <div className="absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-8 translate-x-8 pointer-events-none" style={{ background: accent, opacity: tc.glowOpacity }} />

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: `${accent}${tc.iconBgAlpha}`, color: accent }}>
            {getRoomTypeIcon(room.type)}
          </div>
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold truncate" style={{ color: tc.textPrimary }}>{room.name}</h3>
            <p className="text-[11px]" style={{ color: tc.textMuted }}>{room.floor}</p>
          </div>
        </div>
        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(room) }} className="p-1 rounded transition-colors flex-shrink-0"
          style={{ color: tc.textMuted }}
          onMouseEnter={(e) => { e.currentTarget.style.color = tc.accentGreen }}
          onMouseLeave={(e) => { e.currentTarget.style.color = tc.textMuted }}>
          <Layers className="w-3.5 h-3.5" />
        </button>
      </div>

      {room.description && (
        <p className="text-[11px] mb-3 leading-relaxed" style={{ color: tc.textMuted }}>{room.description}</p>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium" style={{ color: tc.textSecondary }}>Active Schedules:</span>
          <span className="text-[12px] font-bold tabular-nums" style={{ color: activeSchedules.length > 0 ? tc.textPrimary : tc.textFaint }}>{activeSchedules.length}</span>
        </div>

        {activeSchedules.length > 0 && (
          <div className="space-y-1">
            {activeSchedules.slice(0, 2).map((schedule) => {
              const computed = getComputedStatus(schedule)
              const ss = getStatusStyle(computed, tc)
              return (
                <div key={schedule.id} className="flex items-center justify-between">
                  <span className="text-[10px] truncate mr-2" style={{ color: tc.textMuted }}>
                    {getScheduleDisplayName(schedule.schedule.title, schedule.frequency)}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold flex-shrink-0"
                    style={{ background: ss.bg, color: ss.text, border: `1px solid ${ss.border}` }}>
                    {getStatusLabel(computed)}
                  </span>
                </div>
              )
            })}
            {activeSchedules.length > 2 && (
              <p className="text-[10px]" style={{ color: tc.textFaint }}>+{activeSchedules.length - 2} more</p>
            )}
          </div>
        )}

        {completedSchedules.length > 0 && (
          <p className="text-[10px]" style={{ color: tc.textFaint }}>
            {completedSchedules.length} completed schedule{completedSchedules.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: `1px solid ${tc.divider}` }}>
        <span className="text-[12px] font-medium transition-colors" style={{ color: tc.accentGreen }}>
          View Details
        </span>
        <ArrowRight className="w-3 h-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" style={{ color: tc.accentGreen }} />
      </div>
      </Link>
    </motion.div>
  )
}
