"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, Home, Calendar, DoorOpen, BarChart3, AlertTriangle, CheckCircle, Clock, Target, Wrench } from 'lucide-react'
import { ScheduleStatus } from '@prisma/client'
import { useToast } from '@/components/ui/toast-context'
import { useSessionTracking } from '@/hooks/useSessionTracking'
import { apiRequest } from '@/lib/url-utils'

interface Room {
  id: string
  name: string
  type: string
  floor?: string
}

interface Equipment {
  id: string
  name: string
  type: string
  model?: string
  serialNumber?: string
}

interface RoomSchedule {
  id: string
  status: ScheduleStatus
  nextDue: string
  schedule: {
    title: string
  }
}

interface EquipmentSchedule {
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
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [schedules, setSchedules] = useState<RoomSchedule[]>([])
  const [equipmentSchedules, setEquipmentSchedules] = useState<EquipmentSchedule[]>([])
  const [recentActivity, setRecentActivity] = useState<any[]>([])

  // Enable session tracking for admin users
  useSessionTracking({
    updateInterval: 5 * 60 * 1000, // 5 minutes
    trackActivity: true
  })

  const fetchDashboardData = async () => {
    try {
      const [roomsData, equipmentData, schedulesData, equipmentSchedulesData, activityData] = await Promise.all([
        apiRequest('/api/rooms').then(res => {
          if (!res.ok) throw new Error('Failed to fetch rooms')
          return res.json()
        }),
        apiRequest('/api/admin/equipment').then(res => {
          if (!res.ok) throw new Error('Failed to fetch equipment')
          return res.json()
        }),
        apiRequest('/api/room-schedules').then(res => {
          if (!res.ok) throw new Error('Failed to fetch schedules')
          return res.json()
        }),
        apiRequest('/api/equipment-schedules').then(res => {
          if (!res.ok) throw new Error('Failed to fetch equipment schedules')
          return res.json()
        }),
        apiRequest('/api/admin/recent-activity').then(res => {
          if (!res.ok) throw new Error('Failed to fetch recent activity')
          return res.json()
        })
      ])

      setRooms(roomsData)
      setEquipment(equipmentData.equipment || equipmentData)
      setSchedules(schedulesData)
      setEquipmentSchedules(equipmentSchedulesData)
      setRecentActivity(activityData.activities || [])
      setIsLoading(false)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      showToast('Failed to load dashboard data', 'error')
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth')
      return
    }
    
    if (status === 'authenticated') {
      fetchDashboardData()
    }
  }, [status, router, showToast])

  // Real-time updates: Refresh activity every 30 seconds
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.isAdmin) return

    const interval = setInterval(async () => {
      try {
        const activityResponse = await apiRequest('/api/admin/recent-activity')
        if (activityResponse.ok) {
          const activityData = await activityResponse.json()
          setRecentActivity(activityData.activities || [])
        }
      } catch (error) {
        console.error('Error refreshing activity:', error)
      }
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [status, session?.user?.isAdmin])

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
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
  
  // Room schedule stats
  const completedRoomSchedules = schedules.filter(s => s.status === ScheduleStatus.COMPLETED)
  const overdueRoomSchedules = schedules.filter(s => s.status === ScheduleStatus.OVERDUE)
  const pendingRoomSchedules = schedules.filter(s => s.status === ScheduleStatus.PENDING)
  const todayRoomSchedules = pendingRoomSchedules.filter(s => {
    const nextDue = new Date(s.nextDue)
    const today = new Date()
    return nextDue.toDateString() === today.toDateString()
  })

  // Equipment schedule stats
  const completedEquipmentSchedules = equipmentSchedules.filter(s => s.status === ScheduleStatus.COMPLETED)
  const overdueEquipmentSchedules = equipmentSchedules.filter(s => s.status === ScheduleStatus.OVERDUE)
  const pendingEquipmentSchedules = equipmentSchedules.filter(s => s.status === ScheduleStatus.PENDING)
  const todayEquipmentSchedules = pendingEquipmentSchedules.filter(s => {
    const nextDue = new Date(s.nextDue)
    const today = new Date()
    return nextDue.toDateString() === today.toDateString()
  })

  // Combined totals
  const totalSchedules = schedules.length + equipmentSchedules.length
  const totalPendingSchedules = pendingRoomSchedules.length + pendingEquipmentSchedules.length
  const totalTodaySchedules = todayRoomSchedules.length + todayEquipmentSchedules.length
  const totalOverdueSchedules = overdueRoomSchedules.length + overdueEquipmentSchedules.length

  return (
    <div className="min-h-screen">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800/20 backdrop-blur-sm rounded-lg border border-gray-700/30 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Rooms</p>
                <p className="text-2xl font-bold text-gray-100">{rooms.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {bedrooms.length} bedrooms, {otherRooms.length} others
                </p>
              </div>
              <DoorOpen className="w-8 h-8 text-blue-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-gray-800/20 backdrop-blur-sm rounded-lg border border-gray-700/30 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Equipment</p>
                <p className="text-2xl font-bold text-gray-100">{equipment.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Various maintenance items
                </p>
              </div>
              <Wrench className="w-8 h-8 text-purple-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800/20 backdrop-blur-sm rounded-lg border border-gray-700/30 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Active Schedules</p>
                <p className="text-2xl font-bold text-gray-100">{totalSchedules}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {schedules.length} rooms • {equipmentSchedules.length} equipment
                </p>
              </div>
              <Calendar className="w-8 h-8 text-blue-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800/20 backdrop-blur-sm rounded-lg border border-gray-700/30 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Due Today</p>
                <p className="text-2xl font-bold text-yellow-400">{totalTodaySchedules}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {todayRoomSchedules.length} rooms • {todayEquipmentSchedules.length} equipment
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-800/20 backdrop-blur-sm rounded-lg border border-gray-700/30 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Overdue</p>
                <p className="text-2xl font-bold text-red-400">{totalOverdueSchedules}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {overdueRoomSchedules.length} rooms • {overdueEquipmentSchedules.length} equipment
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
            <div className="bg-gray-800/20 backdrop-blur-sm rounded-lg border border-gray-700/30 p-6">
              <h2 className="text-xl font-semibold text-gray-100 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a
                  href="/rooms"
                  className="flex items-center gap-4 p-4 rounded-lg bg-gray-700/20 border border-gray-600/50 hover:border-blue-500/30 hover:bg-gray-700/30 transition-all duration-200 group"
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
            <div className="bg-gray-800/20 backdrop-blur-sm rounded-lg border border-gray-700/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-100">Recent Activity</h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                    <span className="text-xs text-gray-400">
                      {recentActivity.filter(a => a.type === 'session' && a.description.includes('Active')).length} online
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-400">Live</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((activity, index) => {
                  const getActivityIcon = (type: string) => {
                    switch (type) {
                      case 'room_completion':
                        return 'bg-green-400'
                      case 'equipment_completion':
                        return 'bg-blue-400'
                      case 'user_activity':
                        return activity.metadata?.isActive ? 'bg-purple-400' : 'bg-gray-400'
                      default:
                        return 'bg-gray-400'
                    }
                  }

                  const formatDateTime = (timestamp: string) => {
                    const date = new Date(timestamp)
                    return {
                      date: date.toLocaleDateString(),
                      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                  }

                  const { date, time } = formatDateTime(activity.timestamp)

                  return (
                    <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-700/30">
                      <div className={`w-2 h-2 rounded-full ${getActivityIcon(activity.type)}`}></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-100 truncate">
                          {activity.title}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {activity.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-gray-500">
                            {date} at {time}
                          </p>
                          {activity.userEmail && (
                            <>
                              <span className="text-xs text-gray-600">•</span>
                              <p className="text-xs text-gray-500 truncate">
                                {activity.userEmail}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {recentActivity.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-400">No recent activity</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Status Overview */}
        {(totalOverdueSchedules > 0 || totalTodaySchedules > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6"
          >
            <h2 className="text-xl font-semibold text-gray-100 mb-4">Attention Required</h2>
            <div className="space-y-4">
              {totalOverdueSchedules > 0 && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <h3 className="font-medium text-red-300">Overdue Schedules</h3>
                    <span className="px-2 py-1 text-xs rounded-full bg-red-500/20 text-red-300">
                      {totalOverdueSchedules}
                    </span>
                  </div>
                  <p className="text-sm text-red-200/80">
                    {overdueRoomSchedules.length} room schedules and {overdueEquipmentSchedules.length} equipment schedules need immediate attention.
                  </p>
                </div>
              )}

              {totalTodaySchedules > 0 && (
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="w-5 h-5 text-yellow-400" />
                    <h3 className="font-medium text-yellow-300">Due Today</h3>
                    <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-300">
                      {totalTodaySchedules}
                    </span>
                  </div>
                  <p className="text-sm text-yellow-200/80">
                    {todayRoomSchedules.length} room schedules and {todayEquipmentSchedules.length} equipment schedules are due today.
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
