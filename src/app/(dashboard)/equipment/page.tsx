'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, Search, Filter, Edit, Trash2, Calendar, MapPin, 
  Wrench, AlertCircle, CheckCircle, Clock, Settings, X
} from 'lucide-react'

interface Equipment {
  id: string
  name: string
  description: string
  location: string
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

interface EquipmentResponse {
  equipment: Equipment[]
  total: number
}

interface EquipmentFormData {
  name: string
  description: string
  location: string
  type: string
  model: string
  serialNumber: string
  purchaseDate: string
  warrantyExpiry: string
}

const equipmentTypeIcons: Record<string, string> = {
  // Cleaning Equipment
  VACUUM_CLEANER: '🧹',
  FLOOR_SCRUBBER: '🧽',
  CARPET_CLEANER: '🧽',
  PRESSURE_WASHER: '💦',
  WINDOW_CLEANING: '🪟',
  CLEANING_CART: '🛒',
  
  // Building Systems
  HVAC_SYSTEM: '🌬️',
  AIR_PURIFIER: '🌿',
  
  // Kitchen Equipment
  DISHWASHER: '🍽️',
  WASHING_MACHINE: '👕',
  DRYER: '🔥',
  MICROWAVE: '📱',
  REFRIGERATOR: '🧊',
  COFFEE_MACHINE: '☕',
  KITCHEN_EQUIPMENT: '🍳',
  
  // Office Equipment
  PRINTER: '🖨️',
  COMPUTER: '💻',
  PROJECTOR: '📽️',
  
  // Residential/Healthcare Equipment
  WHEELCHAIR: '♿',
  SARA_STEADY: '🚶‍♀️',
  HOIST: '⬆️',
  SHOWER_CHAIR: '🚿',
  TOILET_FRAME: '🚽',
  WALKING_FRAME: '🚶‍♂️',
  WALKING_STICK: '🦯',
  ZIMMER_FRAME: '🚶',
  HOSPITAL_BED: '🛏️',
  COMMODE: '🚽',
  MOBILITY_SCOOTER: '🛴',
  PATIENT_LIFT: '⬆️',
  TRANSFER_BOARD: '📋',
  STANDING_AID: '🧍',
  ROLLATOR: '🚶‍♀️',
  GRAB_RAILS: '🤚',
  BATH_LIFT: '🛁',
  RISE_RECLINE_CHAIR: '🪑',
  PROFILING_BED: '🛏️',
  MATTRESS: '🛏️',
  CUSHION: '🛋️',
  
  // General
  INDUSTRIAL_EQUIPMENT: '⚙️',
  OTHER: '📦'
}

const equipmentTypes = Object.keys(equipmentTypeIcons).map(key => ({
  value: key,
  label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}))

export default function EquipmentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [formData, setFormData] = useState<EquipmentFormData>({
    name: '',
    description: '',
    location: '',
    type: 'OTHER',
    model: '',
    serialNumber: '',
    purchaseDate: '',
    warrantyExpiry: ''
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
      fetchEquipment()
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
      location: '',
      type: 'OTHER',
      model: '',
      serialNumber: '',
      purchaseDate: '',
      warrantyExpiry: ''
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
      location: equip.location || '',
      type: equip.type,
      model: equip.model || '',
      serialNumber: equip.serialNumber || '',
      purchaseDate: equip.purchaseDate ? new Date(equip.purchaseDate).toISOString().split('T')[0] : '',
      warrantyExpiry: equip.warrantyExpiry ? new Date(equip.warrantyExpiry).toISOString().split('T')[0] : ''
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
                         equip.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (equip.model && equip.model.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesType = typeFilter === 'all' || equip.type === typeFilter
    const matchesLocation = locationFilter === 'all' || equip.location === locationFilter
    
    return matchesSearch && matchesType && matchesLocation
  })

  const locations = [...new Set(equipment.map(e => e.location))].sort()
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

      {/* Filters */}
      <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
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
            {types.map(type => (
              <option key={type} value={type}>
                {type.replace('_', ' ')}
              </option>
            ))}
          </select>

          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
          >
            <option value="all">All Locations</option>
            {locations.map(location => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>

          <div className="text-sm text-gray-400 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            {filteredEquipment.length} of {equipment.length} equipment
          </div>
        </div>
      </div>

      {/* Equipment Grid */}
      {filteredEquipment.length === 0 ? (
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
      ) : (
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
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <MapPin className="w-3 h-3" />
                      <span>{equip.location}</span>
                    </div>
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
      )}

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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Location
                      </label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                        placeholder="Enter location"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Model
                      </label>
                      <input
                        type="text"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                        placeholder="Enter model"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Serial Number
                      </label>
                      <input
                        type="text"
                        value={formData.serialNumber}
                        onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                        placeholder="Enter serial number"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Purchase Date
                      </label>
                      <input
                        type="date"
                        value={formData.purchaseDate}
                        onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Warranty Expiry
                      </label>
                      <input
                        type="date"
                        value={formData.warrantyExpiry}
                        onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                      />
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
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Location
                      </label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                        placeholder="Enter location"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Model
                      </label>
                      <input
                        type="text"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                        placeholder="Enter model"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Serial Number
                      </label>
                      <input
                        type="text"
                        value={formData.serialNumber}
                        onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                        placeholder="Enter serial number"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Purchase Date
                      </label>
                      <input
                        type="date"
                        value={formData.purchaseDate}
                        onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Warranty Expiry
                      </label>
                      <input
                        type="date"
                        value={formData.warrantyExpiry}
                        onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:border-teal-500 focus:outline-none"
                      />
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
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4">
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
                      <p className="text-sm text-gray-400">{selectedEquipment.location}</p>
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