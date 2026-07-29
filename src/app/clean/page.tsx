"use client"

import { useEffect, useState, type CSSProperties } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useSessionTracking } from '@/hooks/useSessionTracking'
import { useThemeColors } from '@/hooks/useThemeColors'
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

type ThemeColors = ReturnType<typeof useThemeColors>

// Theme-aware status chip styles (replaces hardcoded text-*-400 classes)
function statusChipStyle(tc: ThemeColors, status: string): CSSProperties {
  switch (status) {
    case 'OVERDUE': return { background: tc.statusOverdue.bg, color: tc.statusOverdue.text, borderColor: tc.statusOverdue.border }
    case 'PENDING': return { background: tc.statusPending.bg, color: tc.statusPending.text, borderColor: tc.statusPending.border }
    case 'IN_PROGRESS': return { background: tc.statusActive.bg, color: tc.statusActive.text, borderColor: tc.statusActive.border }
    case 'COMPLETED': return { background: tc.statusCompleted.bg, color: tc.statusCompleted.text, borderColor: tc.statusCompleted.border }
    default: return { background: tc.emptyBg, color: tc.textMuted, borderColor: tc.cardBorder }
  }
}

function CleanerHeader() {
  const { data: session } = useSession()
  const tc = useThemeColors()

  if (!session?.user) return null

  return (
    <header className="mb-8">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: tc.textPrimary }}>
          Welcome back, {session.user.name?.split(' ')[0]}!
        </h1>
        <p style={{ color: tc.textMuted }}>Here's your cleaning schedule for today.</p>
      </div>
    </header>
  )
}

export default function CleanerDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const tc = useThemeColors()
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
      
      const response = await apiRequest('/api/cleaner/dashboard')
      
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
    const skelBar: CSSProperties = { background: tc.btnSecondaryHoverBg }
    const skelBarFaint: CSSProperties = { background: tc.btnSecondaryBg }
    const skelCard: CSSProperties = { background: tc.cardBg, border: `1px solid ${tc.cardBorder}` }

    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="h-9 rounded-lg w-80 mb-2 animate-pulse" style={skelBar}></div>
            <div className="h-5 rounded w-64 animate-pulse" style={skelBarFaint}></div>
          </div>

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-lg p-6" style={skelCard}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="h-4 rounded w-20 mb-2 animate-pulse" style={skelBar}></div>
                    <div className="h-8 rounded w-12 animate-pulse" style={skelBar}></div>
                  </div>
                  <div className="w-8 h-8 rounded animate-pulse" style={skelBar}></div>
                </div>
              </div>
            ))}
          </div>

          {/* Search and Filters Skeleton */}
          <div className="rounded-lg p-6 mb-8" style={skelCard}>
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
              <div className="h-10 rounded flex-1 animate-pulse" style={skelBar}></div>
              <div className="flex gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 w-[140px] rounded animate-pulse" style={skelBar}></div>
                ))}
              </div>
            </div>
          </div>

          {/* Room Cards Skeleton */}
          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-6 rounded animate-pulse" style={skelBar}></div>
                <div className="h-6 rounded w-40 animate-pulse" style={skelBar}></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-lg p-6 h-64" style={skelCard}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded animate-pulse" style={skelBar}></div>
                        <div>
                          <div className="h-6 rounded w-24 mb-2 animate-pulse" style={skelBar}></div>
                          <div className="h-4 rounded w-32 animate-pulse" style={skelBarFaint}></div>
                        </div>
                      </div>
                      <div className="w-5 h-5 rounded animate-pulse" style={skelBar}></div>
                    </div>

                    <div className="space-y-2 mb-4">
                      {[...Array(2)].map((_, j) => (
                        <div key={j} className="flex items-center justify-between">
                          <div className="h-4 rounded w-32 animate-pulse" style={skelBarFaint}></div>
                          <div className="h-6 rounded w-20 animate-pulse" style={skelBarFaint}></div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 mt-auto" style={{ borderTop: `1px solid ${tc.divider}` }}>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <div className="h-3 rounded w-24 animate-pulse" style={skelBarFaint}></div>
                          <div className="h-3 rounded w-16 animate-pulse" style={skelBarFaint}></div>
                        </div>
                        <div className="flex justify-between">
                          <div className="h-3 rounded w-20 animate-pulse" style={skelBarFaint}></div>
                          <div className="h-3 rounded w-24 animate-pulse" style={skelBarFaint}></div>
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
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: tc.statusOverdue.text }} />
          <p style={{ color: tc.statusOverdue.text }}>{error}</p>
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
    <div className="min-h-screen" style={{ color: tc.textSecondary }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CleanerHeader />

        {/* Success Message */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.36 }}
              className="mb-6 p-4 rounded-lg"
              style={{ background: tc.statusCompleted.bg, border: `1px solid ${tc.statusCompleted.border}` }}
            >
              <p className="text-center" style={{ color: tc.statusCompleted.text }}>{successMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.36 }}
            className="rounded-lg p-6"
            style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: tc.textMuted }}>Total Tasks</p>
                <p className="text-2xl font-bold" style={{ color: tc.textPrimary }}>{stats.totalTasks}</p>
                <p className="text-xs mt-1" style={{ color: tc.textFaint }}>
                  Rooms: {rooms.reduce((acc, room) => acc + room.summary.totalTasks, 0)} •
                  Equipment: {equipment.reduce((acc, equip) => acc + equip.summary.totalTasks, 0)}
                </p>
              </div>
              <Target className="w-8 h-8" style={{ color: tc.accentBlue }} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.36 }}
            className="rounded-lg p-6"
            style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: tc.textMuted }}>Completed Today</p>
                <p className="text-2xl font-bold" style={{ color: tc.statusCompleted.text }}>{stats.completedToday}</p>
                <p className="text-xs mt-1" style={{ color: tc.textFaint }}>
                  Rooms & Equipment combined
                </p>
              </div>
              <CheckCircle className="w-8 h-8" style={{ color: tc.accentGreen }} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.36 }}
            className="rounded-lg p-6"
            style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: tc.textMuted }}>Due Today</p>
                <p className="text-2xl font-bold" style={{ color: tc.statusPending.text }}>
                  {stats.dueTodayRooms + stats.dueTodayEquipment}
                </p>
                <p className="text-xs mt-1" style={{ color: tc.textFaint }}>
                  Rooms: {stats.dueTodayRooms} • Equipment: {stats.dueTodayEquipment}
                </p>
              </div>
              <Calendar className="w-8 h-8" style={{ color: tc.accentAmber }} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.36 }}
            className="rounded-lg p-6"
            style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: tc.textMuted }}>Overdue</p>
                <p className="text-2xl font-bold" style={{ color: tc.statusOverdue.text }}>
                  {stats.overdueRooms + stats.overdueEquipment}
                </p>
                <p className="text-xs mt-1" style={{ color: tc.textFaint }}>
                  Rooms: {stats.overdueRooms} • Equipment: {stats.overdueEquipment}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8" style={{ color: tc.accentRed }} />
            </div>
          </motion.div>
        </div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.36 }}
          className="rounded-lg p-6 mb-8"
          style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}
        >
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: tc.textMuted }} />
              <Input
                type="text"
                placeholder={
                  displayMode === 'rooms' ? 'Search rooms...' :
                  displayMode === 'equipment' ? 'Search equipment...' :
                  'Search rooms and equipment...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              {/* Display Mode Toggle */}
              <Select value={displayMode} onValueChange={(value: 'rooms' | 'equipment' | 'both') => setDisplayMode(value)}>
                <SelectTrigger className="w-[140px]" style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }}>
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
                <SelectTrigger className="w-[140px]" style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }}>
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
                <SelectTrigger className="w-[140px]" style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }}>
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
                <SelectTrigger className="w-[140px]" style={{ background: tc.inputBg, borderColor: tc.inputBorder, color: tc.inputText }}>
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
              <div className="flex rounded-lg p-1" style={{ background: tc.inputBg, border: `1px solid ${tc.inputBorder}` }}>
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
          <div className="mt-4 flex flex-wrap gap-4 text-sm" style={{ color: tc.textMuted }}>
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
                    <AlertTriangle className="w-6 h-6" style={{ color: tc.statusOverdue.text }} />
                    <h2 className="text-xl font-semibold" style={{ color: tc.statusOverdue.text }}>
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
                    <Calendar className="w-6 h-6" style={{ color: tc.statusPending.text }} />
                    <h2 className="text-xl font-semibold" style={{ color: tc.statusPending.text }}>
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
                    <Clock className="w-6 h-6" style={{ color: tc.accentBlue }} />
                    <h2 className="text-xl font-semibold" style={{ color: tc.accentBlue }}>
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
                    <CheckCircle className="w-6 h-6" style={{ color: tc.statusCompleted.text }} />
                    <h2 className="text-xl font-semibold" style={{ color: tc.statusCompleted.text }}>
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
                    {sortBy === 'floor' ? <Building className="w-6 h-6" style={{ color: tc.accentGreen }} /> : <Hash className="w-6 h-6" style={{ color: tc.accentGreen }} />}
                    <h2 className="text-xl font-semibold" style={{ color: tc.accentGreen }}>
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
                    {sortBy === 'floor' ? <Building className="w-6 h-6" style={{ color: tc.accentIndigo }} /> : <Hash className="w-6 h-6" style={{ color: tc.accentIndigo }} />}
                    <h2 className="text-xl font-semibold" style={{ color: tc.accentIndigo }}>
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
                  <CheckCircle className="w-16 h-16 mx-auto mb-4" style={{ color: tc.accentGreen }} />
                  <h3 className="text-xl font-semibold mb-2" style={{ color: tc.textPrimary }}>All caught up!</h3>
                  <p style={{ color: tc.textMuted }}>
                    {displayMode === 'rooms' ? 'No rooms need cleaning at the moment.' :
                     displayMode === 'equipment' ? 'No equipment needs maintenance at the moment.' :
                     'No rooms or equipment need attention at the moment.'}
                  </p>
                </>
              ) : (
                <>
                  <Search className="w-16 h-16 mx-auto mb-4" style={{ color: tc.textMuted }} />
                  <h3 className="text-xl font-semibold mb-2" style={{ color: tc.textPrimary }}>No items match your filters</h3>
                  <p style={{ color: tc.textMuted }}>Try adjusting your search or filter criteria.</p>
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
  const tc = useThemeColors()

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.03, duration: 0.3 }}
      className="h-full"
    >
      <Link
        href={`/clean/${room.id}`}
        className={`block rounded-lg border-2 p-6 transition-transform duration-200 hover:scale-[1.02] h-full flex flex-col ${priorityColors[priority]}`}
      >
        {/* Header - Fixed height */}
        <div className="flex items-start justify-between mb-4 min-h-[60px]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getRoomTypeIcon(room.type)}</span>
            <div>
              <h3 className="text-lg font-semibold line-clamp-1" style={{ color: tc.textPrimary }}>{room.name}</h3>
              <div className="flex items-center gap-2 text-sm" style={{ color: tc.textMuted }}>
                <MapPin className="w-3 h-3" />
                <span>{room.floor}</span>
                <span>•</span>
                <span>{room.type.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 flex-shrink-0" style={{ color: tc.textMuted }} />
        </div>

        {/* Schedules - Flexible content area */}
        <div className="flex-1 space-y-2 min-h-[80px] overflow-hidden">
          {room.schedules.slice(0, 3).map((schedule) => (
            <div key={schedule.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="truncate" style={{ color: tc.textSecondary }}>{schedule.scheduleType}</span>
                <span className="text-xs flex-shrink-0" style={{ color: tc.textFaint }}>({schedule.tasksCount} tasks)</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="px-2 py-1 rounded text-xs border" style={statusChipStyle(tc, schedule.status)}>
                  {schedule.status}
                </span>
              </div>
            </div>
          ))}
          {room.schedules.length > 3 && (
            <div className="text-xs text-center" style={{ color: tc.textFaint }}>
              +{room.schedules.length - 3} more schedule{room.schedules.length - 3 !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Footer - Fixed height */}
        <div className="mt-4 pt-4 min-h-[60px]" style={{ borderTop: `1px solid ${tc.divider}` }}>
          <div className="flex items-center justify-between text-xs mb-2" style={{ color: tc.textMuted }}>
            <span>{room.summary.totalSchedules} schedule types</span>
            <span>Est. {room.summary.estimatedDuration}</span>
          </div>
          <div className="flex items-center justify-between text-xs" style={{ color: tc.textMuted }}>
            <span>{room.summary.totalTasks} total tasks</span>
            <div className="flex items-center gap-2">
              {room.summary.overdueCount > 0 && (
                <span style={{ color: tc.statusOverdue.text }}>{room.summary.overdueCount} overdue</span>
              )}
              {room.summary.completedCount > 0 && (
                <span style={{ color: tc.statusCompleted.text }}>{room.summary.completedCount} completed</span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom-integrated progress bar */}
        <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: tc.progressBg }}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-400"
            style={{ width: `${computeRoomProgressPercent(room)}%` }}
          />
        </div>
      </Link>
    </motion.div>
  )
}

function computeRoomProgressPercent(room: Room): number {
  const total = room.summary?.totalTasks || 0
  const completed = room.summary?.completedCount || 0
  if (!total) return 0
  const pct = Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
  return pct
}

// NEW: Equipment Card Component
interface EquipmentCardProps {
  equipment: Equipment
  index: number
  priority: 'overdue' | 'today' | 'upcoming' | 'completed'
}

function EquipmentCard({ equipment, index, priority }: EquipmentCardProps) {
  const tc = useThemeColors()

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.03, duration: 0.3 }}
      className="h-full"
    >
      <div className={`rounded-lg border-2 p-6 transition-transform duration-200 hover:scale-[1.02] h-full flex flex-col ${priorityColors[priority]}`}>
        {/* Header - Fixed height */}
        <div className="flex items-start justify-between mb-4 min-h-[60px]">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getEquipmentTypeIcon(equipment.type)}</span>
            <div>
              <h3 className="text-lg font-semibold line-clamp-1" style={{ color: tc.textPrimary }}>{equipment.name}</h3>
              <div className="flex items-center gap-2 text-sm" style={{ color: tc.textMuted }}>
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
          <div className="bg-blue-500/10 px-2 py-1 rounded text-xs border border-blue-500/20" style={{ color: tc.accentBlue }}>
            Equipment
          </div>
        </div>

        {/* Schedules - Flexible content area */}
        <div className="flex-1 space-y-2 min-h-[80px] overflow-hidden">
          {equipment.schedules.slice(0, 3).map((schedule) => (
            <div key={schedule.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="truncate" style={{ color: tc.textSecondary }}>{schedule.scheduleType}</span>
                <span className="text-xs flex-shrink-0" style={{ color: tc.textFaint }}>({schedule.tasksCount} tasks)</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="px-2 py-1 rounded text-xs border" style={statusChipStyle(tc, schedule.status)}>
                  {schedule.status}
                </span>
              </div>
            </div>
          ))}
          {equipment.schedules.length > 3 && (
            <div className="text-xs text-center" style={{ color: tc.textFaint }}>
              +{equipment.schedules.length - 3} more schedule{equipment.schedules.length - 3 !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Footer - Fixed height */}
        <div className="mt-4 pt-4 min-h-[60px]" style={{ borderTop: `1px solid ${tc.divider}` }}>
          <div className="flex items-center justify-between text-xs mb-2" style={{ color: tc.textMuted }}>
            <span>{equipment.summary.totalSchedules} schedule types</span>
            <span>Est. {equipment.summary.estimatedDuration}</span>
          </div>
          <div className="flex items-center justify-between text-xs" style={{ color: tc.textMuted }}>
            <span>{equipment.summary.totalTasks} total tasks</span>
            <div className="flex items-center gap-2">
              {equipment.summary.overdueCount > 0 && (
                <span style={{ color: tc.statusOverdue.text }}>{equipment.summary.overdueCount} overdue</span>
              )}
              {equipment.summary.completedCount > 0 && (
                <span style={{ color: tc.statusCompleted.text }}>{equipment.summary.completedCount} completed</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}