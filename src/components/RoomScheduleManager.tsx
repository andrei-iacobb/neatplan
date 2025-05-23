import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { useToast } from './ui/toast-context'
import { getFrequencyLabel } from '@/lib/schedule-utils'
import { format } from 'date-fns'

interface Schedule {
  id: string
  title: string
  tasks: { description: string }[]
}

interface RoomSchedule {
  id: string
  frequency: string
  nextDue: Date
  lastCompleted?: Date | null
  status: string
  schedule: Schedule
}

interface RoomScheduleManagerProps {
  roomId: string
  onUpdate?: () => void
}

export function RoomScheduleManager({ roomId, onUpdate }: RoomScheduleManagerProps) {
  const { showToast } = useToast()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [roomSchedules, setRoomSchedules] = useState<RoomSchedule[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState('')
  const [selectedFrequency, setSelectedFrequency] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Fetch available schedules
  useEffect(() => {
    async function fetchSchedules() {
      try {
        const res = await fetch('/api/schedules')
        if (!res.ok) throw new Error('Failed to fetch schedules')
        const data = await res.json()
        setSchedules(data)
      } catch (error) {
        console.error('Error fetching schedules:', error)
        showToast('Failed to fetch schedules', 'error')
      }
    }

    fetchSchedules()
  }, [showToast])

  // Fetch room schedules
  useEffect(() => {
    async function fetchRoomSchedules() {
      try {
        const res = await fetch(`/api/rooms/${roomId}/schedules`)
        if (!res.ok) throw new Error('Failed to fetch room schedules')
        const data = await res.json()
        setRoomSchedules(data)
      } catch (error) {
        console.error('Error fetching room schedules:', error)
        showToast('Failed to fetch room schedules', 'error')
      }
    }

    if (roomId) {
      fetchRoomSchedules()
    }
  }, [roomId, showToast])

  const assignSchedule = async () => {
    if (!selectedSchedule || !selectedFrequency) {
      showToast('Please select a schedule and frequency', 'error')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/rooms/${roomId}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: selectedSchedule,
          frequency: selectedFrequency
        })
      })

      if (!res.ok) throw new Error('Failed to assign schedule')
      
      showToast('Schedule assigned successfully', 'success')
      setSelectedSchedule('')
      setSelectedFrequency('')
      onUpdate?.()

      // Refresh room schedules
      const updatedRes = await fetch(`/api/rooms/${roomId}/schedules`)
      if (!updatedRes.ok) throw new Error('Failed to fetch updated schedules')
      const data = await updatedRes.json()
      setRoomSchedules(data)
    } catch (error) {
      console.error('Error assigning schedule:', error)
      showToast('Failed to assign schedule', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const markCompleted = async (scheduleId: string) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/schedules/${scheduleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Completed via room schedule manager' })
      })

      if (!res.ok) throw new Error('Failed to mark schedule as completed')
      
      showToast('Schedule marked as completed', 'success')
      
      // Refresh room schedules
      const updatedRes = await fetch(`/api/rooms/${roomId}/schedules`)
      if (!updatedRes.ok) throw new Error('Failed to fetch updated schedules')
      const data = await updatedRes.json()
      setRoomSchedules(data)
      
      onUpdate?.()
    } catch (error) {
      console.error('Error marking schedule as completed:', error)
      showToast('Failed to mark schedule as completed', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/50 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-medium text-gray-100">Assign New Schedule</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            value={selectedSchedule}
            onValueChange={setSelectedSchedule}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a schedule" />
            </SelectTrigger>
            <SelectContent>
              {schedules.map(schedule => (
                <SelectItem key={schedule.id} value={schedule.id}>
                  {schedule.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedFrequency}
            onValueChange={setSelectedFrequency}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Daily</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="BIWEEKLY">Bi-weekly</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="QUARTERLY">Quarterly</SelectItem>
              <SelectItem value="YEARLY">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={assignSchedule}
          disabled={isLoading || !selectedSchedule || !selectedFrequency}
          className="w-full sm:w-auto"
        >
          Assign Schedule
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-100">Assigned Schedules</h3>
        {roomSchedules.length === 0 ? (
          <p className="text-gray-400">No schedules assigned to this room yet.</p>
        ) : (
          <div className="space-y-4">
            {roomSchedules.map(roomSchedule => (
              <div
                key={roomSchedule.id}
                className="bg-gray-800/30 rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-100">
                    {roomSchedule.schedule.title}
                  </h4>
                  <Button
                    onClick={() => markCompleted(roomSchedule.schedule.id)}
                    disabled={roomSchedule.status === 'COMPLETED'}
                    variant="outline"
                    size="sm"
                  >
                    Mark Complete
                  </Button>
                </div>
                <div className="text-sm text-gray-400 space-y-1">
                  <p>Frequency: {getFrequencyLabel(roomSchedule.frequency as any)}</p>
                  <p>Next due: {format(new Date(roomSchedule.nextDue), 'PPP')}</p>
                  {roomSchedule.lastCompleted && (
                    <p>Last completed: {format(new Date(roomSchedule.lastCompleted), 'PPP')}</p>
                  )}
                  <p>Status: {roomSchedule.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 