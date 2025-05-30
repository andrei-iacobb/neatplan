"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, Home, Calendar, DoorOpen, BarChart3, AlertTriangle, CheckCircle, Clock, Target } from 'lucide-react'
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
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-teal-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
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
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-gray-100 mb-2"
          >
            Welcome back, {session.user.name || 'Admin'}! 👋
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-400"
          >
            Here's an overview of your cleaning management system
          </motion.p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Rooms</p>
                <p className="text-2xl font-bold text-gray-100">{rooms.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {bedrooms.length} bedrooms, {otherRooms.length} others
                </p>
              </div>
              <DoorOpen className="w-8 h-8 text-teal-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Active Schedules</p>
                <p className="text-2xl font-bold text-gray-100">{schedules.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {pendingSchedules.length} pending
                </p>
              </div>
              <Calendar className="w-8 h-8 text-blue-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Due Today</p>
                <p className="text-2xl font-bold text-yellow-400">{todaySchedules.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Needs attention
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Overdue</p>
                <p className="text-2xl font-bold text-red-400">{overdueSchedules.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Requires immediate action
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-2"
          >
            <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-100 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a
                  href="/rooms"
                  className="flex items-center gap-4 p-4 rounded-lg bg-gray-700/30 border border-gray-600 hover:border-teal-500/50 hover:bg-gray-700/50 transition-all duration-200 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                    <DoorOpen className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-100">Manage Rooms</h3>
                    <p className="text-sm text-gray-400">Add or edit rooms</p>
                  </div>
                </a>

                <a
                  href="/schedule"
                  className="flex items-center gap-4 p-4 rounded-lg bg-gray-700/30 border border-gray-600 hover:border-teal-500/50 hover:bg-gray-700/50 transition-all duration-200 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                    <Calendar className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-100">Create Schedule</h3>
                    <p className="text-sm text-gray-400">Set up cleaning schedules</p>
                  </div>
                </a>

                <a
                  href="/upload"
                  className="flex items-center gap-4 p-4 rounded-lg bg-gray-700/30 border border-gray-600 hover:border-teal-500/50 hover:bg-gray-700/50 transition-all duration-200 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                    <BarChart3 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-100">Upload Document</h3>
                    <p className="text-sm text-gray-400">Process cleaning documents</p>
                  </div>
                </a>

                <a
                  href="/cleaning"
                  className="flex items-center gap-4 p-4 rounded-lg bg-gray-700/30 border border-gray-600 hover:border-teal-500/50 hover:bg-gray-700/50 transition-all duration-200 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center group-hover:bg-teal-500/30 transition-colors">
                    <CheckCircle className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-100">View Tasks</h3>
                    <p className="text-sm text-gray-400">Manage cleaning tasks</p>
                  </div>
                </a>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-100 mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {completedSchedules.slice(0, 5).map((schedule, index) => (
                  <div key={schedule.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/30">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-100 truncate">
                        Schedule completed
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(schedule.nextDue).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
                {completedSchedules.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-400">No recent activity</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Status Overview */}
        {(overdueSchedules.length > 0 || todaySchedules.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6"
          >
            <h2 className="text-xl font-semibold text-gray-100 mb-4">Attention Required</h2>
            <div className="space-y-4">
              {overdueSchedules.length > 0 && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <h3 className="font-medium text-red-300">Overdue Schedules</h3>
                    <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-300">
                      {overdueSchedules.length}
                    </span>
                  </div>
                  <p className="text-sm text-red-200/80">
                    These schedules are past their due date and need immediate attention.
                  </p>
                </div>
              )}

              {todaySchedules.length > 0 && (
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="w-5 h-5 text-yellow-400" />
                    <h3 className="font-medium text-yellow-300">Due Today</h3>
                    <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-300">
                      {todaySchedules.length}
                    </span>
                  </div>
                  <p className="text-sm text-yellow-200/80">
                    These schedules are due today and should be completed.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
