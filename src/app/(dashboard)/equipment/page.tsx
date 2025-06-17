'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, Search, Filter, Edit, Trash2, Calendar, MapPin, 
  Wrench, AlertCircle, CheckCircle, Clock, Settings, X,
  HeartHandshake, Sparkles, Box, Loader2
} from 'lucide-react'

interface Equipment {
  id: string
  name: string
  description: string
  type: string
  model: string
  serialNumber: string
  purchaseDate: string
  warrantyExpiry: string
  createdAt: string
  updatedAt: string
  scheduleCount: number
  totalTasks: number
  schedules: {
    id: string
    title: string
    frequency: string
    nextDue: string
    status: string
    tasksCount: number
  }[]
}

interface Schedule {
  id: string
  title: string
  suggestedFrequency?: string
  tasks: any[]
}

type ViewMode = 'EQUIPMENT' | 'SCHEDULES'
type AssignMode = 'QUICK' | 'MANUAL'

enum ScheduleFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY'
}

interface EquipmentResponse {
  equipment: Equipment[]
  total: number
}

interface EquipmentFormData {
  name: string
  description: string
  type: string
}

const equipmentTypeIcons: { [key: string]: React.ReactNode } = {
  RESIDENT_AID: <HeartHandshake className="w-6 h-6" />,
  CLEANING_EQUIPMENT: <Sparkles className="w-6 h-6" />,
  OTHER: <Box className="w-6 h-6" />
}

const equipmentTypes = [
  { value: 'RESIDENT_AID', label: 'Resident Aid' },
  { value: 'CLEANING_EQUIPMENT', label: 'Cleaning Equipment' },
  { value: 'OTHER', label: 'Other' }
]

export default function EquipmentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('EQUIPMENT')
  const [assignMode, setAssignMode] = useState<AssignMode>('QUICK')
  const [selectedSchedule, setSelectedSchedule] = useState<string>('')
  const [selectedFrequency, setSelectedFrequency] = useState<ScheduleFrequency>(ScheduleFrequency.WEEKLY)
  const [selectedEquipmentType, setSelectedEquipmentType] = useState<string>('OTHER')
  const [isAssigning, setIsAssigning] = useState(false)

  const [formData, setFormData] = useState<EquipmentFormData>({
    name: '',
    description: '',
    type: 'OTHER',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth')
      return
    }

    if (status === 'authenticated' && !session?.user?.isAdmin) {
      router.replace('/clean')
      return
    }

    if (status === 'authenticated') {
      Promise.all([
        fetch('/api/admin/equipment').then(res => res.json()),
        fetch('/api/schedules').then(res => res.json())
      ]).then(([equipmentData, schedulesData]) => {
        setEquipment(equipmentData.equipment)
        setSchedules(schedulesData)
        setIsLoading(false)
      }).catch(error => {
        console.error('Error fetching data:', error)
        setError('Failed to load data')
        setIsLoading(false)
      })
    }
  }, [status, session, router])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'OTHER',
    })
  }

  const fetchEquipment = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin/equipment')
      if (!response.ok) throw new Error('Failed to fetch equipment')
      
      const data: EquipmentResponse = await response.json()
      setEquipment(data.equipment)
    } catch (error) {
      console.error('Error fetching equipment:', error)
      setError('Failed to load equipment')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleQuickAssign() {
    if (!selectedSchedule || !selectedEquipmentType || !selectedFrequency) return

    setIsAssigning(true)
    try {
      // Get all equipment of selected type
      const targetEquipment = equipment.filter(equip => equip.type === selectedEquipmentType)
      
      // Assign schedule to each equipment
      await Promise.all(
        targetEquipment.map(equip =>
          fetch(`/api/admin/equipment/${equip.id}/schedules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scheduleId: selectedSchedule,
              frequency: selectedFrequency
            })
          })
        )
      )

      setSuccessMessage(`Schedule assigned to all ${selectedEquipmentType.toLowerCase().replace('_', ' ')} equipment`)
      setSelectedSchedule('')
      setSelectedFrequency(ScheduleFrequency.WEEKLY) // Reset to default
      // Refresh equipment data
      fetchEquipment()
    } catch (error) {
      console.error('Error assigning schedules:', error)
      setError('Failed to assign schedules')
    } finally {
      setIsAssigning(false)
    }
  }

  // Handler for schedule selection that sets suggested frequency automatically
  const handleScheduleSelection = (scheduleId: string) => {
    setSelectedSchedule(scheduleId)
    
    if (scheduleId) {
      const schedule = schedules.find(s => s.id === scheduleId)
      if (schedule?.suggestedFrequency) {
        setSelectedFrequency(schedule.suggestedFrequency as ScheduleFrequency)
      }
    }
  }

  async function handleManualAssign() {
    if (!selectedSchedule || !selectedEquipment || !selectedFrequency) return

    setIsAssigning(true)
    try {
      const response = await fetch(`/api/admin/equipment/${selectedEquipment.id}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: selectedSchedule,
          frequency: selectedFrequency
        })
      })

      if (!response.ok) throw new Error('Failed to assign schedule')

      setSuccessMessage('Schedule assigned successfully')
      setSelectedSchedule('')
      setSelectedEquipment(null)
      // Refresh equipment data
      fetchEquipment()
    } catch (error) {
      console.error('Error assigning schedule:', error)
      setError('Failed to assign schedule')
    } finally {
      setIsAssigning(false)
    }
  }

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    try {
      setIsSubmitting(true)
      const response = await fetch('/api/admin/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add equipment')
      }

      await fetchEquipment()
      setShowAddModal(false)
      resetForm()
      setSuccessMessage('Equipment added successfully!')
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditEquipment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting || !selectedEquipment) return

    try {
      setIsSubmitting(true)
      const response = await fetch(`/api/admin/equipment/${selectedEquipment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update equipment')
      }

      await fetchEquipment()
      setShowEditModal(false)
      setSelectedEquipment(null)
      resetForm()
      setSuccessMessage('Equipment updated successfully!')
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteEquipment = async () => {
    if (isSubmitting || !selectedEquipment) return

    try {
      setIsSubmitting(true)
      const response = await fetch(`/api/admin/equipment/${selectedEquipment.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete equipment')
      }

      await fetchEquipment()
      setShowDeleteModal(false)
      setSelectedEquipment(null)
      setSuccessMessage('Equipment deleted successfully!')
    } catch (error: any) {
      setError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEditModal = (equip: Equipment) => {
    setSelectedEquipment(equip)
    setFormData({
      name: equip.name,
      description: equip.description || '',
      type: equip.type,
    })
    setShowEditModal(true)
  }

  const openDeleteModal = (equip: Equipment) => {
    setSelectedEquipment(equip)
    setShowDeleteModal(true)
  }

  const filteredEquipment = equipment.filter(equip => {
    const matchesSearch = equip.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         equip.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (equip.model && equip.model.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesType = typeFilter === 'all' || equip.type === typeFilter
    
    return matchesSearch && matchesType
  })

  const types = [...new Set(equipment.map(e => e.type))].sort()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'OVERDUE':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'PENDING':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-teal-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-100 mb-2">Error</h2>
          <p className="text-gray-400">{error}</p>
          <button
            onClick={() => {
              setError(null)
              fetchEquipment()
            }}
            className="mt-4 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Success Message */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-100">Equipment Management</h1>
          <p className="text-gray-400 mt-2">Manage maintenance equipment and schedules</p>
        </div>
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg bg-gray-800 border border-gray-600 p-1">
            <button
              onClick={() => setViewMode('EQUIPMENT')}
              className={`px-4 py-2 rounded transition-colors ${
                viewMode === 'EQUIPMENT'
                  ? 'bg-teal-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Equipment
            </button>
            <button
              onClick={() => setViewMode('SCHEDULES')}
              className={`px-4 py-2 rounded transition-colors ${
                viewMode === 'SCHEDULES'
                  ? 'bg-teal-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Assign Schedules
            </button>
          </div>
          
          <button
            onClick={() => {
              resetForm()
              setShowAddModal(true)
            }}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Equipment
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search equipment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:border-teal-500 focus:outline-none"
            />
          </div>
          
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
          >
            <option value="all">All Types</option>
            {equipmentTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <div className="text-sm text-gray-400 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            {filteredEquipment.length} of {equipment.length} equipment
          </div>
        </div>
      </div>

      {/* Schedule Assignment Section */}
      {viewMode === 'SCHEDULES' && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-6">Schedule Assignment</h2>
          
          {/* Assignment Mode Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setAssignMode('QUICK')}
              className={`px-4 py-2 rounded ${
                assignMode === 'QUICK'
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-teal-500/10 hover:text-teal-300'
              } border transition-colors`}
            >
              Quick Assign
            </button>
            <button
              onClick={() => setAssignMode('MANUAL')}
              className={`px-4 py-2 rounded ${
                assignMode === 'MANUAL'
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-teal-500/10 hover:text-teal-300'
              } border transition-colors`}
            >
              Manual Assign
            </button>
          </div>

          {assignMode === 'QUICK' && (
            <div className="bg-gray-900/50 rounded-lg border border-gray-600 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">Quick Assignment</h3>
              <p className="text-gray-400 mb-4">Assign a schedule to all equipment of a specific type</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Schedule</label>
                  <select
                    value={selectedSchedule}
                    onChange={(e) => handleScheduleSelection(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                  >
                    <option value="">Select Schedule</option>
                    {schedules.map(schedule => (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.title} ({schedule.tasks.length} tasks)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Equipment Type</label>
                  <select
                    value={selectedEquipmentType}
                    onChange={(e) => setSelectedEquipmentType(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                  >
                    {equipmentTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Frequency</label>
                  <select
                    value={selectedFrequency}
                    onChange={(e) => setSelectedFrequency(e.target.value as ScheduleFrequency)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Bi-weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
              </div>
              
              <button
                onClick={handleQuickAssign}
                disabled={!selectedSchedule || !selectedEquipmentType || isAssigning}
                className="flex items-center px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded border border-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAssigning ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Assign to All {selectedEquipmentType.replace('_', ' ')} Equipment
              </button>
            </div>
          )}

          {assignMode === 'MANUAL' && (
            <div className="bg-gray-900/50 rounded-lg border border-gray-600 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-100 mb-4">Manual Assignment</h3>
              <p className="text-gray-400 mb-4">Assign a schedule to a specific equipment</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Schedule</label>
                  <select
                    value={selectedSchedule}
                    onChange={(e) => handleScheduleSelection(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                  >
                    <option value="">Select Schedule</option>
                    {schedules.map(schedule => (
                      <option key={schedule.id} value={schedule.id}>
                        {schedule.title} ({schedule.tasks.length} tasks)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Equipment</label>
                  <select
                    value={selectedEquipment?.id || ''}
                    onChange={(e) => {
                      const equip = equipment.find(r => r.id === e.target.value)
                      setSelectedEquipment(equip || null)
                    }}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                  >
                    <option value="">Select Equipment</option>
                    {equipment.map(equip => (
                      <option key={equip.id} value={equip.id}>
                        {equip.name} ({equip.type.replace('_', ' ')})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Frequency</label>
                  <select
                    value={selectedFrequency}
                    onChange={(e) => setSelectedFrequency(e.target.value as ScheduleFrequency)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Bi-weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
              </div>
              
              <button
                onClick={handleManualAssign}
                disabled={!selectedSchedule || !selectedEquipment || isAssigning}
                className="flex items-center px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded border border-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAssigning ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Assign Schedule
              </button>
            </div>
          )}
        </div>
      )}

      {/* Equipment Grid */}
      {viewMode === 'EQUIPMENT' && filteredEquipment.length === 0 ? (
        <div className="text-center py-12">
          <Wrench className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-100 mb-2">
            {equipment.length === 0 ? 'No Equipment Added' : 'No Equipment Found'}
          </h3>
          <p className="text-gray-400 mb-4">
            {equipment.length === 0 
              ? 'Get started by adding your first piece of equipment'
              : 'Try adjusting your search filters'
            }
          </p>
          {equipment.length === 0 && (
            <button
              onClick={() => {
                resetForm()
                setShowAddModal(true)
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Add Equipment
            </button>
          )}
        </div>
      ) : viewMode === 'EQUIPMENT' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEquipment.map((equip, index) => (
            <motion.div
              key={equip.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{equipmentTypeIcons[equip.type] || '📦'}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-100">{equip.name}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(equip)}
                    className="p-1 text-gray-400 hover:text-teal-400 transition-colors"
                    title="Edit equipment"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openDeleteModal(equip)}
                    className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                    title="Delete equipment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                <div className="text-sm">
                  <span className="text-gray-400">Type:</span>
                  <span className="text-gray-200 ml-2">{equip.type.replace('_', ' ')}</span>
                </div>
                {equip.model && (
                  <div className="text-sm">
                    <span className="text-gray-400">Model:</span>
                    <span className="text-gray-200 ml-2">{equip.model}</span>
                  </div>
                )}
                {equip.serialNumber && (
                  <div className="text-sm">
                    <span className="text-gray-400">Serial:</span>
                    <span className="text-gray-200 ml-2">{equip.serialNumber}</span>
                  </div>
                )}
              </div>

              {/* Schedules */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-100">
                    Schedules ({equip.schedules.length})
                  </span>
                </div>
                {equip.schedules.length > 0 ? (
                  <div className="space-y-1">
                    {equip.schedules.slice(0, 2).map(schedule => (
                      <div key={schedule.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-300">{schedule.title}</span>
                        <span className={`px-2 py-1 rounded border ${getStatusColor(schedule.status)}`}>
                          {schedule.status}
                        </span>
                      </div>
                    ))}
                    {equip.schedules.length > 2 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{equip.schedules.length - 2} more
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">No schedules assigned</div>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-xs text-gray-400 pt-4 border-t border-gray-700">
                <span>{equip.totalTasks} total tasks</span>
                <span>Added {new Date(equip.createdAt).toLocaleDateString()}</span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : null}

      {/* Add Equipment Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-100">Add New Equipment</h2>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="text-gray-400 hover:text-gray-300 p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAddEquipment} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                      placeholder="Enter equipment name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                    >
                      {equipmentTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                      placeholder="Enter description"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 md:col-span-2">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Adding...
                        </>
                      ) : (
                        'Add Equipment'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Equipment Modal */}
      <AnimatePresence>
        {showEditModal && selectedEquipment && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-100">Edit Equipment</h2>
                  <button
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedEquipment(null)
                      resetForm()
                    }}
                    className="text-gray-400 hover:text-gray-300 p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleEditEquipment} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                      placeholder="Enter equipment name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                    >
                      {equipmentTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                      placeholder="Enter description"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4 md:col-span-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false)
                        setSelectedEquipment(null)
                        resetForm()
                      }}
                      className="px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Updating...
                        </>
                      ) : (
                        'Update Equipment'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && selectedEquipment && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl w-full max-w-md"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-100">Delete Equipment</h2>
                  <button
                    onClick={() => {
                      setShowDeleteModal(false)
                      setSelectedEquipment(null)
                    }}
                    className="text-gray-400 hover:text-gray-300 p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">{equipmentTypeIcons[selectedEquipment.type] || '📦'}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-100">{selectedEquipment.name}</h3>
                    </div>
                  </div>
                  
                  <p className="text-gray-300 mb-4">
                    Are you sure you want to delete this equipment? This action cannot be undone.
                  </p>
                  
                  {selectedEquipment.schedules.length > 0 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
                      <p className="text-yellow-400 text-sm">
                        ⚠️ This equipment has {selectedEquipment.schedules.length} active schedule(s) that will also be deleted.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false)
                      setSelectedEquipment(null)
                    }}
                    className="px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteEquipment}
                    disabled={isSubmitting}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Deleting...
                      </>
                    ) : (
                      'Delete Equipment'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
} 