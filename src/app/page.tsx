"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Building2, Bed, Calendar, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { ScheduleStatus } from '@/types/schedule'
import { useToast } from '@/components/ui/toast-context'

interface Room {
  id: string
  name: string
  type: string
  floor?: string
}

interface RoomSchedule {
  id: string
  status: ScheduleStatus
  nextDue: string
  schedule: {
    title: string
  }
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { showToast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [rooms, setRooms] = useState<Room[]>([])
  const [schedules, setSchedules] = useState<RoomSchedule[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth')
      return
    }
    
    if (status === 'authenticated') {
      Promise.all([
        fetch('/api/rooms').then(res => {
          if (!res.ok) throw new Error('Failed to fetch rooms')
          return res.json()
        }),
        fetch('/api/room-schedules').then(res => {
          if (!res.ok) throw new Error('Failed to fetch schedules')
          return res.json()
        })
      ]).then(([roomsData, schedulesData]) => {
        setRooms(roomsData)
        setSchedules(schedulesData)
        setIsLoading(false)
      }).catch(error => {
        console.error('Error fetching dashboard data:', error)
        showToast('Failed to load dashboard data', 'error')
        setIsLoading(false)
      })
    }
  }, [status, router, showToast])

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  const bedrooms = rooms.filter(room => room.type === 'BEDROOM')
  const otherRooms = rooms.filter(room => room.type !== 'BEDROOM')
  const completedSchedules = schedules.filter(s => s.status === ScheduleStatus.COMPLETED)
  const overdueSchedules = schedules.filter(s => s.status === ScheduleStatus.OVERDUE)
  const pendingSchedules = schedules.filter(s => s.status === ScheduleStatus.PENDING)
  const todaySchedules = pendingSchedules.filter(s => {
    const nextDue = new Date(s.nextDue)
    const today = new Date()
    return nextDue.toDateString() === today.toDateString()
  })

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-6 py-8">
        <div className="grid gap-6">
          {/* Overview Stats */}
          <div className="backdrop-blur-sm bg-black/10 rounded-lg p-6 shadow-xl border border-white/5">
            <h2 className="text-xl font-light text-teal-300 mb-4">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-500/10 rounded">
                    <Bed className="h-5 w-5 text-teal-300" />
                  </div>
                  <div>
                    <p className="text-2xl font-light text-teal-400">{bedrooms.length}</p>
                    <p className="text-sm text-gray-400">Bedrooms</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-500/10 rounded">
                    <Building2 className="h-5 w-5 text-teal-300" />
                  </div>
                  <div>
                    <p className="text-2xl font-light text-teal-400">{otherRooms.length}</p>
                    <p className="text-sm text-gray-400">Other Rooms</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded">
                    <CheckCircle2 className="h-5 w-5 text-green-300" />
                  </div>
                  <div>
                    <p className="text-2xl font-light text-green-400">{completedSchedules.length}</p>
                    <p className="text-sm text-gray-400">Completed Tasks</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/10 rounded">
                    <Clock className="h-5 w-5 text-yellow-300" />
                  </div>
                  <div>
                    <p className="text-2xl font-light text-yellow-400">{pendingSchedules.length}</p>
                    <p className="text-sm text-gray-400">Upcoming Tasks</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Today's Tasks */}
          <div className="backdrop-blur-sm bg-black/10 rounded-lg p-6 shadow-xl border border-white/5">
            <h2 className="text-xl font-light text-teal-300 mb-4">Today's Tasks</h2>
            <div className="space-y-4">
              {todaySchedules.length === 0 ? (
                <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                  <p className="text-gray-400 text-sm">No tasks scheduled for today</p>
                </div>
              ) : (
                todaySchedules.map(schedule => (
                  <div key={schedule.id} className="bg-white/5 p-4 rounded-lg border border-white/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-gray-200">{schedule.schedule.title}</h3>
                        <p className="text-sm text-gray-400">Due today</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-xs bg-yellow-500/10 text-yellow-300 rounded-full">
                          Pending
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Attention Required */}
          {overdueSchedules.length > 0 && (
            <div className="backdrop-blur-sm bg-black/10 rounded-lg p-6 shadow-xl border border-white/5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <h2 className="text-xl font-light text-red-400">Attention Required</h2>
              </div>
              <div className="space-y-4">
                {overdueSchedules.map(schedule => (
                  <div key={schedule.id} className="bg-white/5 p-4 rounded-lg border border-white/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-gray-200">{schedule.schedule.title}</h3>
                        <p className="text-sm text-gray-400">
                          Due {new Date(schedule.nextDue).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 text-xs bg-red-500/10 text-red-300 rounded-full">
                          Overdue
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
