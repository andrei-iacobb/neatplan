'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, 
  Wrench, 
  DoorOpen, 
  Calendar, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  TrendingUp,
  Activity
} from 'lucide-react'
import Link from 'next/link'
import { apiRequest } from '@/lib/url-utils'

interface DashboardStats {
  totalUsers: number
  totalRooms: number
  totalEquipment: number
  totalSchedules: number
  completedToday: number
  overdueItems: number
  pendingItems: number
  recentActivity: any[]
}

export function DashboardOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalRooms: 0,
    totalEquipment: 0,
    totalSchedules: 0,
    completedToday: 0,
    overdueItems: 0,
    pendingItems: 0,
    recentActivity: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true)
      
      // Fetch data from multiple endpoints
      const [usersRes, roomsRes, equipmentRes, schedulesRes, activityRes] = await Promise.all([
        apiRequest('/api/users').catch(() => ({ ok: false })),
        apiRequest('/api/rooms').catch(() => ({ ok: false })),
        apiRequest('/api/admin/equipment').catch(() => ({ ok: false })),
        apiRequest('/api/schedules').catch(() => ({ ok: false })),
        apiRequest('/api/admin/recent-activity').catch(() => ({ ok: false }))
      ])

      // Process the data
      const users = usersRes.ok && 'json' in usersRes ? await usersRes.json() : []
      const rooms = roomsRes.ok && 'json' in roomsRes ? await roomsRes.json() : []
      const equipment = equipmentRes.ok && 'json' in equipmentRes ? await equipmentRes.json() : { equipment: [] }
      const schedules = schedulesRes.ok && 'json' in schedulesRes ? await schedulesRes.json() : []
      const activity = activityRes.ok && 'json' in activityRes ? await activityRes.json() : { recentActivity: [] }

      setStats({
        totalUsers: Array.isArray(users) ? users.length : 0,
        totalRooms: Array.isArray(rooms) ? rooms.length : 0,
        totalEquipment: Array.isArray(equipment.equipment) ? equipment.equipment.length : 0,
        totalSchedules: Array.isArray(schedules) ? schedules.length : 0,
        completedToday: 0, // TODO: Calculate from API
        overdueItems: 0,   // TODO: Calculate from API
        pendingItems: 0,   // TODO: Calculate from API
        recentActivity: activity.recentActivity || []
      })

    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      setError('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  const quickActions = [
    {
      name: 'Manage Rooms',
      href: '/rooms',
      icon: DoorOpen,
      description: 'Add, edit, and manage cleaning locations',
      color: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    },
    {
      name: 'Equipment',
      href: '/equipment',
      icon: Wrench,
      description: 'Manage maintenance equipment and schedules',
      color: 'bg-orange-500/10 text-orange-400 border-orange-500/30'
    },
    {
      name: 'Schedules',
      href: '/schedule',
      icon: Calendar,
      description: 'Create and manage cleaning schedules',
      color: 'bg-green-500/10 text-green-400 border-green-500/30'
    },
    {
      name: 'Users',
      href: '/users',
      icon: Users,
      description: 'Manage team members and permissions',
      color: 'bg-purple-500/10 text-purple-400 border-purple-500/30'
    }
  ]

  const statCards = [
    {
      name: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'text-blue-400',
      change: null
    },
    {
      name: 'Rooms',
      value: stats.totalRooms,
      icon: DoorOpen,
      color: 'text-green-400',
      change: null
    },
    {
      name: 'Equipment',
      value: stats.totalEquipment,
      icon: Wrench,
      color: 'text-orange-400',
      change: null
    },
    {
      name: 'Active Schedules',
      value: stats.totalSchedules,
      icon: Calendar,
      color: 'text-purple-400',
      change: null
    }
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-100 mb-2">Error</h2>
          <p className="text-gray-400">{error}</p>
          <button
            onClick={fetchDashboardStats}
            className="mt-4 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto relative z-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Admin Dashboard</h1>
        <p className="text-gray-400">Overview of your cleaning management system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="card backdrop-blur-sm p-6 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-100 mt-1">{stat.value}</p>
              </div>
              <stat.icon className={`w-8 h-8 ${stat.color}`} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <motion.div
              key={action.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="h-full"
            >
              <Link
                href={action.href}
                className={`block p-4 card card-hover transition-all duration-200 hover:scale-105 h-full flex flex-col ${action.color}`}
              >
                <div className="flex items-center mb-2">
                  <action.icon className="w-5 h-5 mr-2" />
                  <h3 className="font-medium">{action.name}</h3>
                </div>
                <p className="text-sm text-gray-400 flex-1">{action.description}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Recent Activity</h2>
        <div className="card backdrop-blur-sm p-6 shadow-lg">
          {stats.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {stats.recentActivity.slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 text-sm">
                  <Activity className="w-4 h-4 text-teal-400" />
                  <span className="text-gray-300">Recent activity item {index + 1}</span>
                  <span className="text-gray-500 text-xs">Just now</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No recent activity</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 