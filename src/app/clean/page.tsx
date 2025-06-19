"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useSessionTracking } from '@/hooks/useSessionTracking'
import Link from 'next/link'
import { 
  Target, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  ArrowRight, 
  MapPin,
  Search,
  Filter,
  SortAsc,
  Building,
  Hash,
  Layers
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { getScheduleDisplayName } from '@/lib/schedule-utils'
import { apiRequest } from '@/lib/url-utils'
import { AnimatePresence } from 'framer-motion'

interface Schedule {
  id: string
  title: string
  frequency: string
  nextDue: string
  status: string
  tasksCount: number
  estimatedDuration: string
  scheduleType: string
}

interface RoomSummary {
  totalSchedules: number
  totalTasks: number
  estimatedDuration: string
  overdueCount: number
  pendingCount: number
  completedCount: number
}

interface Room {
  id: string
  name: string
  type: string
  floor: string
  priority: 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'COMPLETED'
  nextDue: string
  summary: RoomSummary
  schedules: Schedule[]
}

// NEW: Equipment interfaces
interface EquipmentSummary {
  totalSchedules: number
  totalTasks: number
  estimatedDuration: string
  overdueCount: number
  pendingCount: number
  completedCount: number
}

interface Equipment {
  id: string
  name: string
  type: string
  location: string
  model: string
  serialNumber: string
  priority: 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'COMPLETED'
  nextDue: string
  summary: EquipmentSummary
  schedules: Schedule[]
}

interface Stats {
  totalTasks: number
  completedToday: number
  dueTodayRooms: number
  overdueRooms: number
  completedRooms: number
  pendingRooms: number
  totalActiveRooms: number
  // NEW: Equipment stats
  dueTodayEquipment: number
  overdueEquipment: number
  completedEquipment: number
  pendingEquipment: number
  totalActiveEquipment: number
}

function CleanerHeader() {
  const { data: session } = useSession()
  
  if (!session?.user) return null

  return (
    <header className="mb-8">
      <div>
        <h1 className="text-3xl font-bold text-white">
          Welcome back, {session.user.name?.split(' ')[0]}!
        </h1>
        <p className="text-gray-400">Here's your cleaning schedule for today.</p>
      </div>
    </header>
  )
}

export default function CleanerDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([]) // NEW: Equipment state
  const [stats, setStats] = useState<Stats>({
    totalTasks: 0,
    completedToday: 0,
    dueTodayRooms: 0,
    overdueRooms: 0,
    completedRooms: 0,
    pendingRooms: 0,
    totalActiveRooms: 0,
    // NEW: Initialize equipment stats
    dueTodayEquipment: 0,
    overdueEquipment: 0,
    completedEquipment: 0,
    pendingEquipment: 0,
    totalActiveEquipment: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Filter and search states
  const [searchTerm, setSearchTerm] = useState('')
  const [floorFilter, setFloorFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('priority') // priority, name, floor, type
  const [view, setView] = useState<'priority' | 'organized'>('priority')
  const [displayMode, setDisplayMode] = useState<'rooms' | 'equipment' | 'both'>('both') // NEW: Display mode

  // Enable session tracking for cleaner users
  useSessionTracking({
    updateInterval: 5 * 60 * 1000, // 5 minutes
    trackActivity: true
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth')
      return
    }

    if (status === 'authenticated') {
      // Redirect admins away from cleaner interface
      if (session?.user?.isAdmin) {
        router.replace('/')
        return
      }

      fetchDashboardData()
    }
  }, [status, router, session])

  useEffect(() => {
    // Clear success message after 5 seconds
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  useEffect(() => {
    // Check for completion success message
    const urlParams = new URLSearchParams(window.location.search)
    const completed = urlParams.get('completed')
    if (completed === 'true') {
      setSuccessMessage('Room cleaning completed successfully! 🎉')
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      if (isInitialLoad) {
        setError(null)
      }
      
      const response = await apiRequest('/api/cleaner/dashboard', {
        // Add cache control for better performance
        headers: {
          'Cache-Control': 'max-age=30, stale-while-revalidate=60'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const data = await response.json()
      setRooms(data.rooms)
      setEquipment(data.equipment)
      setStats(data.stats)
      setIsInitialLoad(false)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="h-9 bg-gray-800/50 rounded-lg w-80 mb-2 animate-pulse"></div>
            <div className="h-5 bg-gray-800/30 rounded w-64 animate-pulse"></div>
          </div>

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="h-4 bg-gray-700/50 rounded w-20 mb-2 animate-pulse"></div>
                    <div className="h-8 bg-gray-700/50 rounded w-12 animate-pulse"></div>
                  </div>
                  <div className="w-8 h-8 bg-gray-700/50 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Search and Filters Skeleton */}
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6 mb-8">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
              <div className="h-10 bg-gray-700/50 rounded flex-1 animate-pulse"></div>
              <div className="flex gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 w-[140px] bg-gray-700/50 rounded animate-pulse"></div>
                ))}
              </div>
            </div>
          </div>

          {/* Room Cards Skeleton */}
          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-6 bg-gray-700/50 rounded animate-pulse"></div>
                <div className="h-6 bg-gray-700/50 rounded w-40 animate-pulse"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-gray-800/30 border border-gray-700/50 rounded-lg p-6 h-64">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-700/50 rounded animate-pulse"></div>
                        <div>
                          <div className="h-6 bg-gray-700/50 rounded w-24 mb-2 animate-pulse"></div>
                          <div className="h-4 bg-gray-700/30 rounded w-32 animate-pulse"></div>
                        </div>
                      </div>
                      <div className="w-5 h-5 bg-gray-700/50 rounded animate-pulse"></div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      {[...Array(2)].map((_, j) => (
                        <div key={j} className="flex items-center justify-between">
                          <div className="h-4 bg-gray-700/30 rounded w-32 animate-pulse"></div>
                          <div className="h-6 bg-gray-700/30 rounded w-20 animate-pulse"></div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="border-t border-gray-700/50 pt-4 mt-auto">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <div className="h-3 bg-gray-700/30 rounded w-24 animate-pulse"></div>
                          <div className="h-3 bg-gray-700/30 rounded w-16 animate-pulse"></div>
                        </div>
                        <div className="flex justify-between">
                          <div className="h-3 bg-gray-700/30 rounded w-20 animate-pulse"></div>
                          <div className="h-3 bg-gray-700/30 rounded w-24 animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400">{error}</p>
          <Button onClick={fetchDashboardData} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  // Filter and sort rooms
  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.floor.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFloor = floorFilter === 'all' || room.floor === floorFilter
    const matchesType = typeFilter === 'all' || room.type === typeFilter
    
    return matchesSearch && matchesFloor && matchesType
  })

  const sortedRooms = [...filteredRooms].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'floor':
        return a.floor.localeCompare(b.floor)
      case 'type':
        return a.type.localeCompare(b.type)
      case 'priority':
      default:
        // Sort by priority: overdue > today > upcoming > completed
        const getPriority = (room: Room) => {
          switch (room.priority) {
            case 'OVERDUE': return 4
            case 'DUE_TODAY': return 3
            case 'UPCOMING': return 2
            case 'COMPLETED': return 1
            default: return 0
          }
        }
        
        return getPriority(b) - getPriority(a)
    }
  })

  // Categorize rooms for organized view
  const categorizeRooms = (rooms: Room[]) => {
    const categories: { [key: string]: Room[] } = {}
    
    rooms.forEach(room => {
      const key = sortBy === 'floor' ? room.floor : 
                  sortBy === 'type' ? room.type.replace('_', ' ') :
                  room.floor // default to floor
      
      if (!categories[key]) {
        categories[key] = []
      }
      categories[key].push(room)
    })
    
    return categories
  }

  const roomCategories = categorizeRooms(sortedRooms)

  // Get unique values for filters
  const floors = [...new Set(rooms.map(r => r.floor))].sort()
  const types = [...new Set(rooms.map(r => r.type))].sort()

  // Categorize by priority for priority view (using new priority system)
  const overdueRooms = sortedRooms.filter(room => room.priority === 'OVERDUE')
  const todayRooms = sortedRooms.filter(room => room.priority === 'DUE_TODAY')
  const upcomingRooms = sortedRooms.filter(room => room.priority === 'UPCOMING')
  const completedRooms = sortedRooms.filter(room => room.priority === 'COMPLETED')

  // NEW: Filter and sort equipment (mirrors room logic)
  const filteredEquipment = equipment.filter(equip => {
    const matchesSearch = equip.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         equip.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         equip.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (equip.model && equip.model.toLowerCase().includes(searchTerm.toLowerCase()))
    // For equipment, location acts like floor for filtering
    const matchesFloor = floorFilter === 'all' || equip.location === floorFilter
    const matchesType = typeFilter === 'all' || equip.type === typeFilter
    
    return matchesSearch && matchesFloor && matchesType
  })

  const sortedEquipment = [...filteredEquipment].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'floor': // Use location for equipment
        return a.location.localeCompare(b.location)
      case 'type':
        return a.type.localeCompare(b.type)
      case 'priority':
      default:
        // Sort by priority: overdue > today > upcoming > completed
        const getPriority = (equip: Equipment) => {
          switch (equip.priority) {
            case 'OVERDUE': return 4
            case 'DUE_TODAY': return 3
            case 'UPCOMING': return 2
            case 'COMPLETED': return 1
            default: return 0
          }
        }
        
        return getPriority(b) - getPriority(a)
    }
  })

  // NEW: Categorize equipment for organized view
  const categorizeEquipment = (equipment: Equipment[]) => {
    const categories: { [key: string]: Equipment[] } = {}
    
    equipment.forEach(equip => {
      const key = sortBy === 'floor' ? equip.location : 
                  sortBy === 'type' ? equip.type.replace('_', ' ') :
                  equip.location // default to location
      
      if (!categories[key]) {
        categories[key] = []
      }
      categories[key].push(equip)
    })
    
    return categories
  }

  const equipmentCategories = categorizeEquipment(sortedEquipment)

  // NEW: Get unique values for equipment filters
  const locations = [...new Set(equipment.map(e => e.location))].sort()
  const equipmentTypes = [...new Set(equipment.map(e => e.type))].sort()

  // NEW: Categorize equipment by priority for priority view
  const overdueEquipment = sortedEquipment.filter(equip => equip.priority === 'OVERDUE')
  const todayEquipment = sortedEquipment.filter(equip => equip.priority === 'DUE_TODAY')
  const upcomingEquipment = sortedEquipment.filter(equip => equip.priority === 'UPCOMING')
  const completedEquipment = sortedEquipment.filter(equip => equip.priority === 'COMPLETED')

  // Combined unique values for filters (rooms + equipment)
  const allFilters = {
    floors: displayMode === 'equipment' ? locations : 
            displayMode === 'rooms' ? floors :
            [...new Set([...floors, ...locations])].sort(),
    types: displayMode === 'equipment' ? equipmentTypes :
           displayMode === 'rooms' ? types :
           [...new Set([...types, ...equipmentTypes])].sort()
  }

  return (
    <div className="min-h-screen text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CleanerHeader />

        {/* Success Message */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.36 }}
              className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
            >
              <p className="text-green-400 text-center">{successMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.36 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Tasks</p>
                <p className="text-2xl font-bold text-gray-100">{stats.totalTasks}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Rooms: {rooms.reduce((acc, room) => acc + room.summary.totalTasks, 0)} • 
                  Equipment: {equipment.reduce((acc, equip) => acc + equip.summary.totalTasks, 0)}
                </p>
              </div>
                              <Target className="w-8 h-8 text-blue-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.36 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Completed Today</p>
                <p className="text-2xl font-bold text-green-400">{stats.completedToday}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Rooms & Equipment combined
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.36 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Due Today</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {stats.dueTodayRooms + stats.dueTodayEquipment}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Rooms: {stats.dueTodayRooms} • Equipment: {stats.dueTodayEquipment}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-yellow-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.36 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Overdue</p>
                <p className="text-2xl font-bold text-red-400">
                  {stats.overdueRooms + stats.overdueEquipment}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Rooms: {stats.overdueRooms} • Equipment: {stats.overdueEquipment}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </motion.div>
        </div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.36 }}
          className="bg-gray-800/50 rounded-lg border border-gray-700 p-6 mb-8"
        >
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder={
                  displayMode === 'rooms' ? 'Search rooms...' :
                  displayMode === 'equipment' ? 'Search equipment...' :
                  'Search rooms and equipment...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-900/50 border-gray-600 text-gray-100"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              {/* Display Mode Toggle */}
              <Select value={displayMode} onValueChange={(value: 'rooms' | 'equipment' | 'both') => setDisplayMode(value)}>
                <SelectTrigger className="w-[140px] bg-gray-900/50 border-gray-600">
                  <Layers className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Display" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="rooms">Rooms Only</SelectItem>
                  <SelectItem value="equipment">Equipment Only</SelectItem>
                </SelectContent>
              </Select>

              <Select value={floorFilter} onValueChange={setFloorFilter}>
                <SelectTrigger className="w-[140px] bg-gray-900/50 border-gray-600">
                  <Building className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Floor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Floors</SelectItem>
                  {allFilters.floors.map(floor => (
                    <SelectItem key={floor} value={floor}>{floor}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] bg-gray-900/50 border-gray-600">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {allFilters.types.map(type => (
                    <SelectItem key={type} value={type}>{type.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px] bg-gray-900/50 border-gray-600">
                  <SortAsc className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="floor">Floor</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                </SelectContent>
              </Select>

              {/* View Toggle */}
              <div className="flex rounded-lg bg-gray-900/50 border border-gray-600 p-1">
                <Button
                  variant={view === 'priority' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView('priority')}
                  className="text-xs"
                >
                  Priority
                </Button>
                <Button
                  variant={view === 'organized' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView('organized')}
                  className="text-xs"
                >
                  Organized
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-400">
            {displayMode === 'both' && (
              <>
                <span>Showing {sortedRooms.length} rooms</span>
                <span>• {equipment.length} equipment</span>
              </>
            )}
            {displayMode === 'rooms' && <span>Showing {sortedRooms.length} of {rooms.length} rooms</span>}
            {displayMode === 'equipment' && <span>Showing {equipment.length} equipment items</span>}
            {searchTerm && <span>• Searching: "{searchTerm}"</span>}
            {floorFilter !== 'all' && <span>• Floor: {floorFilter}</span>}
            {typeFilter !== 'all' && <span>• Type: {typeFilter.replace('_', ' ')}</span>}
          </div>
        </motion.div>

        {/* Room Sections */}
        <div className="space-y-8">
          {view === 'priority' ? (
            <>
              {/* Priority View - Overdue, Today, Upcoming */}
              {/* Overdue Items */}
              {(displayMode !== 'equipment' && overdueRooms.length > 0) || (displayMode !== 'rooms' && overdueEquipment.length > 0) ? (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                    <h2 className="text-xl font-semibold text-red-400">
                      Overdue ({(displayMode !== 'equipment' ? overdueRooms.length : 0) + (displayMode !== 'rooms' ? overdueEquipment.length : 0)})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayMode !== 'equipment' && overdueRooms.map((room, index) => (
                      <RoomCard key={`room-${room.id}`} room={room} index={index} priority="overdue" />
                    ))}
                    {displayMode !== 'rooms' && overdueEquipment.map((equip, index) => (
                      <EquipmentCard key={`equip-${equip.id}`} equipment={equip} index={displayMode === 'equipment' ? index : overdueRooms.length + index} priority="overdue" />
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Due Today Items */}
              {(displayMode !== 'equipment' && todayRooms.length > 0) || (displayMode !== 'rooms' && todayEquipment.length > 0) ? (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <Calendar className="w-6 h-6 text-yellow-400" />
                    <h2 className="text-xl font-semibold text-yellow-400">
                      Due Today ({(displayMode !== 'equipment' ? todayRooms.length : 0) + (displayMode !== 'rooms' ? todayEquipment.length : 0)})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayMode !== 'equipment' && todayRooms.map((room, index) => (
                      <RoomCard key={`room-${room.id}`} room={room} index={index} priority="today" />
                    ))}
                    {displayMode !== 'rooms' && todayEquipment.map((equip, index) => (
                      <EquipmentCard key={`equip-${equip.id}`} equipment={equip} index={displayMode === 'equipment' ? index : todayRooms.length + index} priority="today" />
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Upcoming Items */}
              {(displayMode !== 'equipment' && upcomingRooms.length > 0) || (displayMode !== 'rooms' && upcomingEquipment.length > 0) ? (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <Clock className="w-6 h-6 text-blue-400" />
                    <h2 className="text-xl font-semibold text-blue-400">
                      Upcoming ({(displayMode !== 'equipment' ? upcomingRooms.length : 0) + (displayMode !== 'rooms' ? upcomingEquipment.length : 0)})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayMode !== 'equipment' && upcomingRooms.map((room, index) => (
                      <RoomCard key={`room-${room.id}`} room={room} index={index} priority="upcoming" />
                    ))}
                    {displayMode !== 'rooms' && upcomingEquipment.map((equip, index) => (
                      <EquipmentCard key={`equip-${equip.id}`} equipment={equip} index={displayMode === 'equipment' ? index : upcomingRooms.length + index} priority="upcoming" />
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Completed Items */}
              {(displayMode !== 'equipment' && completedRooms.length > 0) || (displayMode !== 'rooms' && completedEquipment.length > 0) ? (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.36, duration: 0.36 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                    <h2 className="text-xl font-semibold text-green-400">
                      Completed ({(displayMode !== 'equipment' ? completedRooms.length : 0) + (displayMode !== 'rooms' ? completedEquipment.length : 0)})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayMode !== 'equipment' && completedRooms.map((room, index) => (
                      <RoomCard key={`room-${room.id}`} room={room} index={index} priority="completed" />
                    ))}
                    {displayMode !== 'rooms' && completedEquipment.map((equip, index) => (
                      <EquipmentCard key={`equip-${equip.id}`} equipment={equip} index={displayMode === 'equipment' ? index : completedRooms.length + index} priority="completed" />
                    ))}
                  </div>
                </motion.section>
              ) : null}
            </>
          ) : (
            <>
              {/* Organized View - By Floor/Location or Type */}
              {displayMode !== 'equipment' && Object.entries(roomCategories).map(([category, categoryRooms]) => (
                <section key={`rooms-${category}`}>
                  <div className="flex items-center gap-3 mb-4">
                    {sortBy === 'floor' ? <Building className="w-6 h-6 text-teal-400" /> : <Hash className="w-6 h-6 text-teal-400" />}
                    <h2 className="text-xl font-semibold text-teal-400">
                      Rooms: {category} ({categoryRooms.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryRooms.map((room, index) => {
                      // Use the room's built-in priority
                      const priority = room.priority === 'OVERDUE' ? 'overdue' :
                                      room.priority === 'DUE_TODAY' ? 'today' : 
                                      room.priority === 'COMPLETED' ? 'completed' : 'upcoming'
                      
                      return (
                        <RoomCard key={`room-${room.id}`} room={room} index={index} priority={priority} />
                      )
                    })}
                  </div>
                </section>
              ))}
              
              {/* Equipment organized view */}
              {displayMode !== 'rooms' && Object.entries(equipmentCategories).map(([category, categoryEquipment]) => (
                <section key={`equipment-${category}`}>
                  <div className="flex items-center gap-3 mb-4">
                    {sortBy === 'floor' ? <Building className="w-6 h-6 text-purple-400" /> : <Hash className="w-6 h-6 text-purple-400" />}
                    <h2 className="text-xl font-semibold text-purple-400">
                      Equipment: {category} ({categoryEquipment.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryEquipment.map((equip, index) => {
                      // Use the equipment's built-in priority
                      const priority = equip.priority === 'OVERDUE' ? 'overdue' :
                                      equip.priority === 'DUE_TODAY' ? 'today' : 
                                      equip.priority === 'COMPLETED' ? 'completed' : 'upcoming'
                      
                      return (
                        <EquipmentCard key={`equip-${equip.id}`} equipment={equip} index={index} priority={priority} />
                      )
                    })}
                  </div>
                </section>
              ))}
            </>
          )}

          {/* No items found */}
          {((displayMode !== 'equipment' ? sortedRooms.length : 0) + (displayMode !== 'rooms' ? sortedEquipment.length : 0)) === 0 && (
            <div className="text-center py-12">
              {((displayMode !== 'equipment' ? rooms.length : 0) + (displayMode !== 'rooms' ? equipment.length : 0)) === 0 ? (
                <>
                  <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-100 mb-2">All caught up!</h3>
                  <p className="text-gray-400">
                    {displayMode === 'rooms' ? 'No rooms need cleaning at the moment.' :
                     displayMode === 'equipment' ? 'No equipment needs maintenance at the moment.' :
                     'No rooms or equipment need attention at the moment.'}
                  </p>
                </>
              ) : (
                <>
                  <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-100 mb-2">No items match your filters</h3>
                  <p className="text-gray-400">Try adjusting your search or filter criteria.</p>
                  <Button 
                    onClick={() => {
                      setSearchTerm('')
                      setFloorFilter('all')
                      setTypeFilter('all')
                      setSortBy('priority')
                    }}
                    className="mt-4"
                  >
                    Clear Filters
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface RoomCardProps {
  room: Room
  index: number
  priority: 'overdue' | 'today' | 'upcoming' | 'completed'
}

function RoomCard({ room, index, priority }: RoomCardProps) {
  const priorityColors = {
    overdue: 'border-red-400/50 hover:border-red-400/70 bg-red-400/5',
    today: 'border-yellow-400/50 hover:border-yellow-400/70 bg-yellow-400/5',
    upcoming: 'border-blue-400/50 hover:border-blue-400/70 bg-blue-400/5',
    completed: 'border-green-400/50 hover:border-green-400/70 bg-green-400/5'
  }

  const getRoomTypeIcon = (type: string) => {
    switch (type) {
      case 'BEDROOM': return '🛏️'
      case 'BATHROOM': return '🚿'
      case 'KITCHEN': return '🍳'
      case 'OFFICE': return '💼'
      case 'MEETING_ROOM': return '🪑'
      default: return '🏠'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OVERDUE': return 'text-red-400 bg-red-400/10 border-red-400/20'
      case 'PENDING': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
      case 'IN_PROGRESS': return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
      case 'COMPLETED': return 'text-green-400 bg-green-400/10 border-green-400/20'
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.036, duration: 0.36 }}
      className="h-full"
    >
      <Link
        href={`/clean/${room.id}`}
        className={`block rounded-lg border-2 p-6 transition-all duration-300 hover:scale-[1.02] h-full flex flex-col ${priorityColors[priority]}`}
      >
        {/* Header - Fixed height */}
        <div className="flex items-start justify-between mb-4 min-h-[60px]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getRoomTypeIcon(room.type)}</span>
            <div>
              <h3 className="text-lg font-semibold text-gray-100 line-clamp-1">{room.name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <MapPin className="w-3 h-3" />
                <span>{room.floor}</span>
                <span>•</span>
                <span>{room.type.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors flex-shrink-0" />
        </div>

        {/* Schedules - Flexible content area */}
        <div className="flex-1 space-y-2 min-h-[80px] overflow-hidden">
          {room.schedules.slice(0, 3).map((schedule) => (
            <div key={schedule.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-gray-300 truncate">{schedule.scheduleType}</span>
                <span className="text-xs text-gray-500 flex-shrink-0">({schedule.tasksCount} tasks)</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(schedule.status)}`}>
                  {schedule.status}
                </span>
              </div>
            </div>
          ))}
          {room.schedules.length > 3 && (
            <div className="text-xs text-gray-500 text-center">
              +{room.schedules.length - 3} more schedule{room.schedules.length - 3 !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Footer - Fixed height */}
        <div className="mt-4 pt-4 border-t border-gray-700/50 min-h-[60px]">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>{room.summary.totalSchedules} schedule types</span>
            <span>Est. {room.summary.estimatedDuration}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{room.summary.totalTasks} total tasks</span>
            <div className="flex items-center gap-2">
              {room.summary.overdueCount > 0 && (
                <span className="text-red-400">{room.summary.overdueCount} overdue</span>
              )}
              {room.summary.completedCount > 0 && (
                <span className="text-green-400">{room.summary.completedCount} completed</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// NEW: Equipment Card Component
interface EquipmentCardProps {
  equipment: Equipment
  index: number
  priority: 'overdue' | 'today' | 'upcoming' | 'completed'
}

function EquipmentCard({ equipment, index, priority }: EquipmentCardProps) {
  const priorityColors = {
    overdue: 'border-red-400/50 hover:border-red-400/70 bg-red-400/5',
    today: 'border-yellow-400/50 hover:border-yellow-400/70 bg-yellow-400/5',
    upcoming: 'border-blue-400/50 hover:border-blue-400/70 bg-blue-400/5',
    completed: 'border-green-400/50 hover:border-green-400/70 bg-green-400/5'
  }

  const getEquipmentTypeIcon = (type: string) => {
    switch (type) {
      // Cleaning Equipment
      case 'VACUUM_CLEANER': return '🧹'
      case 'FLOOR_SCRUBBER': return '🧽'
      case 'CARPET_CLEANER': return '🧽'
      case 'PRESSURE_WASHER': return '💦'
      case 'WINDOW_CLEANING': return '🪟'
      case 'CLEANING_CART': return '🛒'
      
      // Building Systems
      case 'HVAC_SYSTEM': return '🌬️'
      case 'AIR_PURIFIER': return '🌿'
      
      // Kitchen Equipment
      case 'DISHWASHER': return '🍽️'
      case 'WASHING_MACHINE': return '👕'
      case 'DRYER': return '🔥'
      case 'MICROWAVE': return '📱'
      case 'REFRIGERATOR': return '🧊'
      case 'COFFEE_MACHINE': return '☕'
      case 'KITCHEN_EQUIPMENT': return '🍳'
      
      // Office Equipment
      case 'PRINTER': return '🖨️'
      case 'COMPUTER': return '💻'
      case 'PROJECTOR': return '📽️'
      
      // Residential/Healthcare Equipment
      case 'WHEELCHAIR': return '♿'
      case 'SARA_STEADY': return '🚶‍♀️'
      case 'HOIST': return '⬆️'
      case 'SHOWER_CHAIR': return '🚿'
      case 'TOILET_FRAME': return '🚽'
      case 'WALKING_FRAME': return '🚶‍♂️'
      case 'WALKING_STICK': return '🦯'
      case 'ZIMMER_FRAME': return '🚶'
      case 'HOSPITAL_BED': return '🛏️'
      case 'COMMODE': return '🚽'
      case 'MOBILITY_SCOOTER': return '🛴'
      case 'PATIENT_LIFT': return '⬆️'
      case 'TRANSFER_BOARD': return '📋'
      case 'STANDING_AID': return '🧍'
      case 'ROLLATOR': return '🚶‍♀️'
      case 'GRAB_RAILS': return '🤚'
      case 'BATH_LIFT': return '🛁'
      case 'RISE_RECLINE_CHAIR': return '🪑'
      case 'PROFILING_BED': return '🛏️'
      case 'MATTRESS': return '🛏️'
      case 'CUSHION': return '🛋️'
      
      // General
      case 'INDUSTRIAL_EQUIPMENT': return '⚙️'
      default: return '🔧'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OVERDUE': return 'text-red-400 bg-red-400/10 border-red-400/20'
      case 'PENDING': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
      case 'IN_PROGRESS': return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
      case 'COMPLETED': return 'text-green-400 bg-green-400/10 border-green-400/20'
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.036, duration: 0.36 }}
      className="h-full"
    >
      <div className={`rounded-lg border-2 p-6 transition-all duration-300 hover:scale-[1.02] h-full flex flex-col ${priorityColors[priority]}`}>
        {/* Header - Fixed height */}
        <div className="flex items-start justify-between mb-4 min-h-[60px]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getEquipmentTypeIcon(equipment.type)}</span>
            <div>
              <h3 className="text-lg font-semibold text-gray-100 line-clamp-1">{equipment.name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <MapPin className="w-3 h-3" />
                <span>{equipment.location}</span>
                {equipment.model && (
                  <>
                    <span>•</span>
                    <span>{equipment.model}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="bg-blue-500/10 px-2 py-1 rounded text-xs text-blue-400 border border-blue-500/20">
            Equipment
          </div>
        </div>

        {/* Schedules - Flexible content area */}
        <div className="flex-1 space-y-2 min-h-[80px] overflow-hidden">
          {equipment.schedules.slice(0, 3).map((schedule) => (
            <div key={schedule.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-gray-300 truncate">{schedule.scheduleType}</span>
                <span className="text-xs text-gray-500 flex-shrink-0">({schedule.tasksCount} tasks)</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(schedule.status)}`}>
                  {schedule.status}
                </span>
              </div>
            </div>
          ))}
          {equipment.schedules.length > 3 && (
            <div className="text-xs text-gray-500 text-center">
              +{equipment.schedules.length - 3} more schedule{equipment.schedules.length - 3 !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Footer - Fixed height */}
        <div className="mt-4 pt-4 border-t border-gray-700/50 min-h-[60px]">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>{equipment.summary.totalSchedules} schedule types</span>
            <span>Est. {equipment.summary.estimatedDuration}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{equipment.summary.totalTasks} total tasks</span>
            <div className="flex items-center gap-2">
              {equipment.summary.overdueCount > 0 && (
                <span className="text-red-400">{equipment.summary.overdueCount} overdue</span>
              )}
              {equipment.summary.completedCount > 0 && (
                <span className="text-green-400">{equipment.summary.completedCount} completed</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}