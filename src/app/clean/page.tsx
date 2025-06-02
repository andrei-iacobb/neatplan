"use client"

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
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

interface Stats {
  totalTasks: number
  completedToday: number
  dueTodayRooms: number
  overdueRooms: number
  completedRooms: number
  pendingRooms: number
  totalActiveRooms: number
}

export default function CleanerDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [stats, setStats] = useState<Stats>({
    totalTasks: 0,
    completedToday: 0,
    dueTodayRooms: 0,
    overdueRooms: 0,
    completedRooms: 0,
    pendingRooms: 0,
    totalActiveRooms: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Filter and search states
  const [searchTerm, setSearchTerm] = useState('')
  const [floorFilter, setFloorFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('priority') // priority, name, floor, type
  const [view, setView] = useState<'priority' | 'organized'>('priority')

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
      const response = await fetch('/api/cleaner/dashboard')
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const data = await response.json()
      setRooms(data.rooms)
      setStats(data.stats)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
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
            Welcome back, {session.user.name}! 👋
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-400"
          >
            Ready to make some rooms sparkle? ✨
          </motion.p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
          >
            <p className="text-green-400 text-center">{successMessage}</p>
          </motion.div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Tasks</p>
                <p className="text-2xl font-bold text-gray-100">{stats.totalTasks}</p>
              </div>
              <Target className="w-8 h-8 text-teal-400" />
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
                <p className="text-gray-400 text-sm">Completed Today</p>
                <p className="text-2xl font-bold text-green-400">{stats.completedToday}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
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
                <p className="text-2xl font-bold text-yellow-400">{stats.dueTodayRooms}</p>
              </div>
              <Calendar className="w-8 h-8 text-yellow-400" />
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
                <p className="text-2xl font-bold text-red-400">{stats.overdueRooms}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </motion.div>
        </div>

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gray-800/50 rounded-lg border border-gray-700 p-6 mb-8"
        >
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search rooms by name, type, or floor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-900/50 border-gray-600 text-gray-100"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <Select value={floorFilter} onValueChange={setFloorFilter}>
                <SelectTrigger className="w-[140px] bg-gray-900/50 border-gray-600">
                  <Building className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Floor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Floors</SelectItem>
                  {floors.map(floor => (
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
                  {types.map(type => (
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
            <span>Showing {sortedRooms.length} of {rooms.length} rooms</span>
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
              {/* Overdue Rooms */}
              {overdueRooms.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                    <h2 className="text-xl font-semibold text-red-400">Overdue ({overdueRooms.length})</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {overdueRooms.map((room, index) => (
                      <RoomCard key={room.id} room={room} index={index} priority="overdue" />
                    ))}
                  </div>
                </section>
              )}

              {/* Due Today */}
              {todayRooms.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <Calendar className="w-6 h-6 text-yellow-400" />
                    <h2 className="text-xl font-semibold text-yellow-400">Due Today ({todayRooms.length})</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {todayRooms.map((room, index) => (
                      <RoomCard key={room.id} room={room} index={index} priority="today" />
                    ))}
                  </div>
                </section>
              )}

              {/* Upcoming */}
              {upcomingRooms.length > 0 && (
                <section>
                  <div className="flex items-center gap-3 mb-4">
                    <Clock className="w-6 h-6 text-blue-400" />
                    <h2 className="text-xl font-semibold text-blue-400">Upcoming ({upcomingRooms.length})</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {upcomingRooms.map((room, index) => (
                      <RoomCard key={room.id} room={room} index={index} priority="upcoming" />
                    ))}
                  </div>
                </section>
              )}

              {/* Completed Rooms */}
              {completedRooms.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                    <h2 className="text-xl font-semibold text-green-400">Completed ({completedRooms.length})</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {completedRooms.map((room, index) => (
                      <RoomCard key={room.id} room={room} index={index} priority="completed" />
                    ))}
                  </div>
                </motion.section>
              )}
            </>
          ) : (
            <>
              {/* Organized View - By Floor or Type */}
              {Object.entries(roomCategories).map(([category, categoryRooms]) => (
                <section key={category}>
                  <div className="flex items-center gap-3 mb-4">
                    {sortBy === 'floor' ? <Building className="w-6 h-6 text-teal-400" /> : <Hash className="w-6 h-6 text-teal-400" />}
                    <h2 className="text-xl font-semibold text-teal-400">
                      {category} ({categoryRooms.length})
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryRooms.map((room, index) => {
                      // Use the room's built-in priority
                      const priority = room.priority === 'OVERDUE' ? 'overdue' :
                                      room.priority === 'DUE_TODAY' ? 'today' : 
                                      room.priority === 'COMPLETED' ? 'completed' : 'upcoming'
                      
                      return (
                        <RoomCard key={room.id} room={room} index={index} priority={priority} />
                      )
                    })}
                  </div>
                </section>
              ))}
            </>
          )}

          {/* No rooms */}
          {sortedRooms.length === 0 && (
            <div className="text-center py-12">
              {rooms.length === 0 ? (
                <>
                  <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-100 mb-2">All caught up!</h3>
                  <p className="text-gray-400">No rooms need cleaning at the moment.</p>
                </>
              ) : (
                <>
                  <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-100 mb-2">No rooms match your filters</h3>
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
      transition={{ delay: index * 0.1 }}
    >
      <Link
        href={`/clean/${room.id}`}
        className={`block rounded-lg border-2 p-6 transition-all duration-300 hover:scale-[1.02] ${priorityColors[priority]}`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getRoomTypeIcon(room.type)}</span>
            <div>
              <h3 className="text-lg font-semibold text-gray-100">{room.name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <MapPin className="w-3 h-3" />
                <span>{room.floor}</span>
                <span>•</span>
                <span>{room.type.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
        </div>

        <div className="space-y-2">
          {room.schedules.map((schedule) => (
            <div key={schedule.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-300">{schedule.scheduleType}</span>
                <span className="text-xs text-gray-500">({schedule.tasksCount} tasks)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs border ${getStatusColor(schedule.status)}`}>
                  {schedule.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>{room.summary.totalSchedules} schedule types</span>
            <span>Est. {room.summary.estimatedDuration}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{room.summary.totalTasks} total tasks</span>
            {room.summary.overdueCount > 0 && (
              <span className="text-red-400">{room.summary.overdueCount} overdue</span>
            )}
            {room.summary.completedCount > 0 && (
              <span className="text-green-400">{room.summary.completedCount} completed</span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
} 