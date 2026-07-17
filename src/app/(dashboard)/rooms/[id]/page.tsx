'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useToast } from '@/components/ui/toast-context'
import { useThemeColors } from '@/hooks/useThemeColors'
import { Loader2, Calendar, CheckCircle2, X, Trash2, Pencil, Sparkles } from 'lucide-react'
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
}

interface Schedule {
  id: string
  title: string
  detectedFrequency?: string
  suggestedFrequency?: ScheduleFrequency
  tasks: { id: string; description: string }[]
}

interface RoomSchedule {
  id: string
  roomId: string
  scheduleId: string
  frequency: ScheduleFrequency
  startDate?: Date
  lastCompleted?: Date | null
  nextDue: Date
  status: ScheduleStatus
  createdAt: Date
  updatedAt: Date
  schedule: Schedule
}

export default function RoomDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { showToast } = useToast()
  const tc = useThemeColors()
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
      apiRequest(`/api/rooms/${params.id}`).then(res => res.json()),
      apiRequest('/api/schedules').then(res => res.json()),
      apiRequest(`/api/rooms/${params.id}/schedules`).then(res => res.json())
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
      const response = await apiRequest(`/api/rooms/${params.id}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: selectedSchedule,
          frequency: selectedFrequency
        })
      })

      if (!response.ok) throw new Error('Failed to assign schedule')

      const newRoomSchedule = await response.json()
      setRoomSchedules(prev => [...prev, newRoomSchedule])
      showToast('Schedule assigned successfully', 'success')
      setSelectedSchedule('')
      setSelectedFrequency(ScheduleFrequency.WEEKLY)
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
      const response = await apiRequest(`/api/rooms/${params.id}/schedules/${roomScheduleId}`, {
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
      const res = await apiRequest(`/api/rooms/${room.id}`, {
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
      const res = await apiRequest(`/api/rooms/${room.id}`, {
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
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 rounded-full border-2 border-transparent" style={{ borderTopColor: 'rgb(16,185,129)', borderRightColor: 'rgba(16,185,129,0.3)' }} />
      </div>
    )
  }

  if (!room) {
    return (
      <div className="text-center py-12">
        <p className="text-[13px]" style={{ color: tc.textMuted }}>Room not found</p>
      </div>
    )
  }

  function getStatusStyle(status: ScheduleStatus) {
    if (status === ScheduleStatus.COMPLETED) return tc.statusCompleted
    if (status === ScheduleStatus.OVERDUE) return tc.statusOverdue
    return tc.statusPending
  }

  const selectedScheduleObj = schedules.find(s => s.id === selectedSchedule)

  return (
    <div className="max-w-[1100px] mx-auto relative z-10 pb-8">
      {/* Page Header */}
      <motion.div {...fadeUp} transition={{ duration: 0.4 }} className="mb-10">
        <div className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4" style={{ color: 'rgb(16,185,129)' }} />
              <p className="text-[13px] font-medium tracking-wide uppercase" style={{ color: tc.accentLabel }}>Room Details</p>
            </div>
            <h1 className="text-[32px] font-bold tracking-tight mb-1" style={{ color: tc.textPrimary }}>{room.name}</h1>
            <p className="text-[15px]" style={{ color: tc.textMuted }}>
              {room.floor && <span>{room.floor}</span>}
              {room.floor && <span className="mx-1.5" style={{ color: tc.textFaint }}>&middot;</span>}
              <span className="capitalize">{room.type.replace(/_/g, ' ').toLowerCase()}</span>
            </p>
            {room.description && (
              <p className="text-[13px] mt-1" style={{ color: tc.textMuted }}>{room.description}</p>
            )}
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150"
            style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: `1px solid ${tc.btnPrimaryBorder}` }}
            onMouseEnter={(e) => { e.currentTarget.style.background = tc.btnPrimaryHoverBg }}
            onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnPrimaryBg }}
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Room
          </button>
        </div>
      </motion.div>

      <div className="space-y-4">
        {/* Assign New Schedule Section */}
        <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.1 }}
          className="rounded-xl p-5"
          style={{ background: tc.cardBg, border: '1px solid ' + tc.cardBorder, boxShadow: tc.shadow }}
        >
          <h2 className="text-[15px] font-semibold mb-4" style={{ color: tc.textPrimary }}>Assign New Schedule</h2>
          {schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: tc.emptyBg }}>
                <Calendar className="w-5 h-5" style={{ color: tc.textFaint }} />
              </div>
              <p className="text-[13px] font-medium" style={{ color: tc.textMuted }}>No schedules available</p>
              <p className="text-[11px] mt-1" style={{ color: tc.textFaint }}>Upload a schedule from the Schedules page, then assign it here</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: tc.textSecondary }}>
                    Schedule
                  </label>
                  <select
                    value={selectedSchedule}
                    onChange={(e) => handleScheduleSelection(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors duration-150"
                    style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}
                  >
                    <option value="">Select a schedule</option>
                    {schedules.map((schedule) => (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.title} ({schedule.tasks.length} {schedule.tasks.length === 1 ? 'task' : 'tasks'})
                      </option>
                    ))}
                  </select>
                  {selectedScheduleObj?.detectedFrequency && (
                    <p className="mt-1.5 text-[11px] font-medium" style={{ color: tc.accentGreen }}>
                      AI detected frequency: &ldquo;{selectedScheduleObj.detectedFrequency}&rdquo;
                    </p>
                  )}
                </div>
                <div>
                  <label className="flex items-center text-[12px] font-medium mb-1.5" style={{ color: tc.textSecondary }}>
                    Frequency
                    {selectedScheduleObj?.suggestedFrequency && selectedFrequency === selectedScheduleObj.suggestedFrequency && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: tc.accentGreen }}>
                        <Sparkles className="w-3 h-3" />
                        AI suggested
                      </span>
                    )}
                  </label>
                  <select
                    value={selectedFrequency}
                    onChange={(e) => setSelectedFrequency(e.target.value as ScheduleFrequency)}
                    className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors duration-150"
                    style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}
                  >
                    {Object.values(ScheduleFrequency).map((freq) => (
                      <option key={freq} value={freq}>
                        {getFrequencyLabel(freq as ScheduleFrequency)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3" style={{ borderTop: `1px solid ${tc.divider}`, paddingTop: '16px' }}>
                <button
                  onClick={assignSchedule}
                  disabled={!selectedSchedule || isAssigning}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: `1px solid ${tc.btnPrimaryBorder}` }}
                  onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = tc.btnPrimaryHoverBg }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnPrimaryBg }}
                >
                  {isAssigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isAssigning ? 'Assigning...' : 'Assign Schedule'}
                </button>
                {!selectedSchedule && (
                  <span className="text-[11px]" style={{ color: tc.textFaint }}>Select a schedule to enable assignment</span>
                )}
              </div>
            </>
          )}
        </motion.div>

        {/* Assigned Schedules Section */}
        <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.2 }}
          className="rounded-xl p-5"
          style={{ background: tc.cardBg, border: '1px solid ' + tc.cardBorder, boxShadow: tc.shadow }}
        >
          <h2 className="text-[15px] font-semibold mb-4" style={{ color: tc.textPrimary }}>Assigned Schedules</h2>
          <div className="space-y-2.5">
            {roomSchedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: tc.emptyBg }}>
                  <Calendar className="w-5 h-5" style={{ color: tc.textFaint }} />
                </div>
                <p className="text-[13px] font-medium" style={{ color: tc.textMuted }}>No schedules assigned yet</p>
                <p className="text-[11px] mt-1" style={{ color: tc.textFaint }}>Use the form above to assign a schedule to this room</p>
              </div>
            ) : (
              roomSchedules.map((roomSchedule, i) => {
                const statusStyle = getStatusStyle(roomSchedule.status)
                return (
                  <motion.div
                    key={roomSchedule.id}
                    {...fadeUp}
                    transition={{ duration: 0.3, delay: 0.25 + i * 0.05 }}
                    className="flex items-center justify-between rounded-xl p-4"
                    style={{ background: tc.surfaceBg, border: '1px solid ' + tc.cardBorder }}
                  >
                    <div>
                      <h3 className="text-[13px] font-semibold" style={{ color: tc.textPrimary }}>
                        {getScheduleDisplayName(roomSchedule.schedule.title, roomSchedule.frequency)}
                      </h3>
                      <div className="mt-1.5 flex items-center gap-3 text-[12px]" style={{ color: tc.textMuted }}>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {getFrequencyLabel(roomSchedule.frequency)}
                        </div>
                        <span>Next due: {new Date(roomSchedule.nextDue).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-full"
                        style={{ background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}` }}
                      >
                        {roomSchedule.status}
                      </span>
                      {roomSchedule.status !== ScheduleStatus.COMPLETED && (
                        <button
                          onClick={() => completeSchedule(roomSchedule.id)}
                          disabled={isCompleting}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: tc.statusCompleted.bg, color: tc.statusCompleted.text, border: `1px solid ${tc.statusCompleted.border}` }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Complete</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>
        </motion.div>
      </div>

      {/* Edit Room Modal */}
      {showEditModal && (
        <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center"
          style={{ background: tc.modalOverlay }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl p-6 w-full max-w-lg mx-4"
            style={{ background: tc.modalBg, border: '1px solid ' + tc.cardBorder, boxShadow: tc.shadow }}
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-[16px] font-semibold" style={{ color: tc.textPrimary }}>Edit Room</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-150"
                style={{ color: tc.textMuted }}
                onMouseEnter={(e) => { e.currentTarget.style.background = tc.hoverRow; e.currentTarget.style.color = tc.textSecondary }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = tc.textMuted }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div style={{ borderTop: `1px solid ${tc.divider}`, paddingTop: '20px' }}>
              <form onSubmit={handleEdit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: tc.textSecondary }}>
                      Room Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors duration-150"
                      style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: tc.textSecondary }}>
                      Floor
                    </label>
                    <select
                      value={formData.floor}
                      onChange={e => setFormData(prev => ({ ...prev, floor: e.target.value }))}
                      className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors duration-150"
                      style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}
                    >
                      <option value="Ground Floor">Ground Floor</option>
                      <option value="First Floor">First Floor</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: tc.textSecondary }}>
                    Room Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors duration-150"
                    style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}
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
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: tc.textSecondary }}>
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full rounded-lg px-3 py-2 text-[13px] outline-none transition-colors duration-150 resize-none"
                    style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}
                    rows={3}
                  />
                </div>

                <div style={{ borderTop: `1px solid ${tc.divider}`, paddingTop: '16px' }}>
                  <div className="flex justify-between">
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150"
                      style={{ background: tc.btnDangerBg, color: tc.btnDangerText, border: `1px solid ${tc.btnDangerBorder}` }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = tc.btnDangerHoverBg }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnDangerBg }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Room
                    </button>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowEditModal(false)}
                        className="px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150"
                        style={{ color: tc.textMuted }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = tc.textSecondary }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = tc.textMuted }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: `1px solid ${tc.btnPrimaryBorder}` }}
                        onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = tc.btnPrimaryHoverBg }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnPrimaryBg }}
                      >
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
