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
import { apiRequest } from '@/lib/url-utils'
import { useThemeColors } from '@/hooks/useThemeColors'

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

type ThemeColors = ReturnType<typeof useThemeColors>

function getStatusStyle(status: string, tc: ThemeColors) {
  switch (status) {
    case 'COMPLETED': return tc.statusCompleted
    case 'OVERDUE': return tc.statusOverdue
    case 'PENDING': return tc.statusPending
    default: return { bg: tc.surfaceBg, text: tc.textMuted, border: tc.cardBorder }
  }
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
}

export default function EquipmentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const tc = useThemeColors()
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
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

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
        apiRequest('/api/admin/equipment').then(res => res.json()),
        apiRequest('/api/schedules').then(res => res.json())
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
      const response = await apiRequest('/api/admin/equipment')
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
      const targetEquipment = equipment.filter(equip => equip.type === selectedEquipmentType)

      await Promise.all(
        targetEquipment.map(equip =>
          apiRequest(`/api/admin/equipment/${equip.id}/schedules`, {
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
      setSelectedFrequency(ScheduleFrequency.WEEKLY)
      fetchEquipment()
    } catch (error) {
      console.error('Error assigning schedules:', error)
      setError('Failed to assign schedules')
    } finally {
      setIsAssigning(false)
    }
  }

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
      const response = await apiRequest(`/api/admin/equipment/${selectedEquipment.id}/schedules`, {
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
      const response = await apiRequest('/api/admin/equipment', {
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
      const response = await apiRequest(`/api/admin/equipment/${selectedEquipment.id}`, {
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
      const response = await apiRequest(`/api/admin/equipment/${selectedEquipment.id}`, {
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

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 48, height: 48, borderRadius: '50%',
            border: '3px solid rgba(16,185,129,0.15)',
            borderTopColor: 'rgb(16,185,129)',
          }}
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4" style={{ color: tc.accentRed }} />
          <h2 className="text-xl font-semibold mb-2" style={{ color: tc.textPrimary }}>Error</h2>
          <p style={{ color: tc.textMuted }}>{error}</p>
          <button
            onClick={() => { setError(null); fetchEquipment() }}
            className="mt-4 px-4 py-2 rounded-lg transition-colors"
            style={{
              background: tc.btnPrimaryBg,
              color: tc.btnPrimaryText,
              border: '1px solid ' + tc.btnPrimaryBorder,
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const inputStyle = {
    background: tc.inputBg,
    border: '1px solid ' + tc.inputBorder,
    color: tc.inputText,
    borderRadius: 8,
  }

  const selectStyle = {
    ...inputStyle,
    appearance: 'auto' as const,
  }

  return (
    <div className="max-w-[1100px] mx-auto relative z-10 pb-8 px-4">
      {/* Success Message */}
      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 px-6 py-3 rounded-xl z-50 flex items-center gap-2"
            style={{
              background: tc.statusCompleted.bg,
              color: tc.statusCompleted.text,
              border: '1px solid ' + tc.statusCompleted.border,
              backdropFilter: 'blur(12px)',
            }}
          >
            <CheckCircle className="w-5 h-5" />
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4" style={{ color: 'rgb(16,185,129)' }} />
          <p className="text-[13px] font-medium tracking-wide uppercase" style={{ color: tc.accentLabel }}>Equipment</p>
        </div>
        <h1 className="text-[32px] font-bold tracking-tight mb-1" style={{ color: tc.textPrimary }}>Equipment Management</h1>
        <p className="text-[15px]" style={{ color: tc.textMuted }}>Manage maintenance equipment and schedules</p>
      </div>

      {/* Controls */}
      <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.05 }} className="flex justify-between items-center mb-4">
        <div className="flex rounded-lg p-1" style={{ background: tc.surfaceBg, border: '1px solid ' + tc.cardBorder }}>
          {(['EQUIPMENT', 'SCHEDULES'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="px-4 py-2 rounded-md text-[13px] font-medium transition-all"
              style={viewMode === mode ? {
                background: tc.tabActiveBg,
                color: tc.tabActiveText,
                border: '1px solid ' + tc.tabActiveBorder,
              } : {
                background: 'transparent',
                color: tc.tabInactiveText,
                border: '1px solid transparent',
              }}
            >
              {mode === 'EQUIPMENT' ? 'Equipment' : 'Assign Schedules'}
            </button>
          ))}
        </div>

        <button
          onClick={() => { resetForm(); setShowAddModal(true) }}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors"
          style={{
            background: tc.btnPrimaryBg,
            color: tc.btnPrimaryText,
            border: '1px solid ' + tc.btnPrimaryBorder,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = tc.btnPrimaryHoverBg }}
          onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnPrimaryBg }}
        >
          <Plus className="w-4 h-4" />
          Add Equipment
        </button>
      </motion.div>

      {/* Filters */}
      <motion.div {...fadeUp} transition={{ duration: 0.45, delay: 0.06 }} className="rounded-xl p-4 mb-6" style={{ background: tc.cardBg, border: '1px solid ' + tc.cardBorder, boxShadow: tc.shadow }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: tc.textFaint }} />
            <input
              type="text"
              placeholder="Search equipment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm outline-none"
              style={inputStyle}
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 rounded-lg text-sm outline-none"
            style={selectStyle}
          >
            <option value="all">All Types</option>
            {equipmentTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <div className="text-sm flex items-center gap-2" style={{ color: tc.textMuted }}>
            <Filter className="w-4 h-4" />
            {filteredEquipment.length} of {equipment.length} equipment
          </div>
        </div>
      </motion.div>

      {/* Schedule Assignment Section */}
      {viewMode === 'SCHEDULES' && (
        <motion.div {...fadeUp} transition={{ duration: 0.45, delay: 0.12 }} className="mb-8">
          <h2 className="text-xl font-semibold mb-6" style={{ color: tc.textPrimary }}>Schedule Assignment</h2>

          {/* Assignment Mode Toggle */}
          <div className="flex gap-2 mb-6">
            {(['QUICK', 'MANUAL'] as AssignMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setAssignMode(mode)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={assignMode === mode ? {
                  background: tc.tabActiveBg,
                  color: tc.tabActiveText,
                  border: '1px solid ' + tc.tabActiveBorder,
                } : {
                  background: tc.tabInactiveBg,
                  color: tc.tabInactiveText,
                  border: '1px solid ' + tc.cardBorder,
                }}
              >
                {mode === 'QUICK' ? 'Quick Assign' : 'Manual Assign'}
              </button>
            ))}
          </div>

          {assignMode === 'QUICK' && (
            <div className="rounded-xl p-6 mb-6" style={{ background: tc.cardBg, border: '1px solid ' + tc.cardBorder, boxShadow: tc.shadow }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color: tc.textPrimary }}>Quick Assignment</h3>
              <p className="text-sm mb-4" style={{ color: tc.textMuted }}>Assign a schedule to all equipment of a specific type</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>Schedule</label>
                  <select
                    value={selectedSchedule}
                    onChange={(e) => handleScheduleSelection(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={selectStyle}
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
                  <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>Equipment Type</label>
                  <select
                    value={selectedEquipmentType}
                    onChange={(e) => setSelectedEquipmentType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={selectStyle}
                  >
                    {equipmentTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>Frequency</label>
                  <select
                    value={selectedFrequency}
                    onChange={(e) => setSelectedFrequency(e.target.value as ScheduleFrequency)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={selectStyle}
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
                className="flex items-center px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{
                  background: tc.btnPrimaryBg,
                  color: tc.btnPrimaryText,
                  border: '1px solid ' + tc.btnPrimaryBorder,
                }}
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
            <div className="rounded-xl p-6 mb-6" style={{ background: tc.cardBg, border: '1px solid ' + tc.cardBorder, boxShadow: tc.shadow }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color: tc.textPrimary }}>Manual Assignment</h3>
              <p className="text-sm mb-4" style={{ color: tc.textMuted }}>Assign a schedule to a specific equipment</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>Schedule</label>
                  <select
                    value={selectedSchedule}
                    onChange={(e) => handleScheduleSelection(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={selectStyle}
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
                  <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>Equipment</label>
                  <select
                    value={selectedEquipment?.id || ''}
                    onChange={(e) => {
                      const equip = equipment.find(r => r.id === e.target.value)
                      setSelectedEquipment(equip || null)
                    }}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={selectStyle}
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
                  <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>Frequency</label>
                  <select
                    value={selectedFrequency}
                    onChange={(e) => setSelectedFrequency(e.target.value as ScheduleFrequency)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={selectStyle}
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
                className="flex items-center px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{
                  background: tc.btnPrimaryBg,
                  color: tc.btnPrimaryText,
                  border: '1px solid ' + tc.btnPrimaryBorder,
                }}
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
        </motion.div>
      )}

      {/* Equipment Grid */}
      {viewMode === 'EQUIPMENT' && filteredEquipment.length === 0 ? (
        <motion.div {...fadeUp} transition={{ duration: 0.45, delay: 0.12 }} className="text-center py-16 rounded-xl" style={{ background: tc.emptyBg, border: '1px solid ' + tc.cardBorder }}>
          <div className="w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: tc.surfaceBg }}>
            <Wrench className="w-7 h-7" style={{ color: tc.textFaint }} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: tc.textPrimary }}>
            {equipment.length === 0 ? 'No Equipment Added' : 'No Equipment Found'}
          </h3>
          <p className="text-sm mb-4" style={{ color: tc.textMuted }}>
            {equipment.length === 0
              ? 'Get started by adding your first piece of equipment'
              : 'Try adjusting your search filters'
            }
          </p>
          {equipment.length === 0 && (
            <button
              onClick={() => { resetForm(); setShowAddModal(true) }}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: tc.btnPrimaryBg,
                color: tc.btnPrimaryText,
                border: '1px solid ' + tc.btnPrimaryBorder,
              }}
            >
              Add Equipment
            </button>
          )}
        </motion.div>
      ) : viewMode === 'EQUIPMENT' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEquipment.map((equip, index) => (
            <motion.div
              key={equip.id}
              {...fadeUp}
              transition={{ duration: 0.45, delay: 0.12 + index * 0.06 }}
              className="rounded-xl p-5 transition-all cursor-default"
              style={{
                background: hoveredCard === equip.id ? tc.cardHoverBg : tc.cardBg,
                border: '1px solid ' + (hoveredCard === equip.id ? tc.cardHoverBorder(tc.accentGreen) : tc.cardBorder),
                boxShadow: tc.shadow,
              }}
              onMouseEnter={() => setHoveredCard(equip.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `rgba(16,185,129,0.${tc.iconBgAlpha})`, color: tc.accentGreen }}>
                    {equipmentTypeIcons[equip.type] || <Box className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: tc.textPrimary }}>{equip.name}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(equip)}
                    className="p-1.5 rounded-md transition-colors"
                    style={{ color: tc.textMuted }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = tc.accentGreen)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = tc.textMuted)}
                    title="Edit equipment"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openDeleteModal(equip)}
                    className="p-1.5 rounded-md transition-colors"
                    style={{ color: tc.textMuted }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = tc.accentRed)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = tc.textMuted)}
                    title="Delete equipment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-1.5 mb-4">
                <div className="text-sm">
                  <span style={{ color: tc.textMuted }}>Type:</span>
                  <span className="ml-2" style={{ color: tc.textSecondary }}>{equip.type.replace('_', ' ')}</span>
                </div>
                {equip.model && (
                  <div className="text-sm">
                    <span style={{ color: tc.textMuted }}>Model:</span>
                    <span className="ml-2" style={{ color: tc.textSecondary }}>{equip.model}</span>
                  </div>
                )}
                {equip.serialNumber && (
                  <div className="text-sm">
                    <span style={{ color: tc.textMuted }}>Serial:</span>
                    <span className="ml-2" style={{ color: tc.textSecondary }}>{equip.serialNumber}</span>
                  </div>
                )}
              </div>

              {/* Schedules */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4" style={{ color: tc.textMuted }} />
                  <span className="text-sm font-medium" style={{ color: tc.textPrimary }}>
                    Schedules ({equip.schedules.length})
                  </span>
                </div>
                {equip.schedules.length > 0 ? (
                  <div className="space-y-1.5">
                    {equip.schedules.slice(0, 2).map(schedule => {
                      const ss = getStatusStyle(schedule.status, tc)
                      return (
                        <div key={schedule.id} className="flex items-center justify-between text-xs">
                          <span style={{ color: tc.textSecondary }}>{schedule.title}</span>
                          <span className="px-2 py-0.5 rounded-md" style={{
                            background: ss.bg,
                            color: ss.text,
                            border: '1px solid ' + ss.border,
                          }}>
                            {schedule.status}
                          </span>
                        </div>
                      )
                    })}
                    {equip.schedules.length > 2 && (
                      <div className="text-xs text-center" style={{ color: tc.textFaint }}>
                        +{equip.schedules.length - 2} more
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs" style={{ color: tc.textFaint }}>No schedules assigned</div>
                )}
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between text-xs pt-4" style={{ borderTop: '1px solid ' + tc.divider, color: tc.textFaint }}>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: tc.modalOverlay }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              style={{ background: tc.modalBg, border: '1px solid ' + tc.cardBorder, boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold" style={{ color: tc.textPrimary }}>Add New Equipment</h2>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="p-1 rounded-md transition-colors"
                    style={{ color: tc.textMuted }}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAddEquipment} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={inputStyle}
                      placeholder="Enter equipment name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={selectStyle}
                    >
                      {equipmentTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                      style={inputStyle}
                      placeholder="Enter description"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{ color: tc.textMuted }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                      style={{
                        background: tc.btnPrimaryBg,
                        color: tc.btnPrimaryText,
                        border: '1px solid ' + tc.btnPrimaryBorder,
                      }}
                    >
                      {isSubmitting ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(16,185,129,0.2)', borderTopColor: tc.accentGreen }}
                          />
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: tc.modalOverlay }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              style={{ background: tc.modalBg, border: '1px solid ' + tc.cardBorder, boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold" style={{ color: tc.textPrimary }}>Edit Equipment</h2>
                  <button
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedEquipment(null)
                      resetForm()
                    }}
                    className="p-1 rounded-md transition-colors"
                    style={{ color: tc.textMuted }}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleEditEquipment} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={inputStyle}
                      placeholder="Enter equipment name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={selectStyle}
                    >
                      {equipmentTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                      style={inputStyle}
                      placeholder="Enter description"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false)
                        setSelectedEquipment(null)
                        resetForm()
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{ color: tc.textMuted }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                      style={{
                        background: tc.btnPrimaryBg,
                        color: tc.btnPrimaryText,
                        border: '1px solid ' + tc.btnPrimaryBorder,
                      }}
                    >
                      {isSubmitting ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(16,185,129,0.2)', borderTopColor: tc.accentGreen }}
                          />
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: tc.modalOverlay }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-xl w-full max-w-md"
              style={{ background: tc.modalBg, border: '1px solid ' + tc.cardBorder, boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold" style={{ color: tc.textPrimary }}>Delete Equipment</h2>
                  <button
                    onClick={() => {
                      setShowDeleteModal(false)
                      setSelectedEquipment(null)
                    }}
                    className="p-1 rounded-md transition-colors"
                    style={{ color: tc.textMuted }}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `rgba(16,185,129,0.${tc.iconBgAlpha})`, color: tc.accentGreen }}>
                      {equipmentTypeIcons[selectedEquipment.type] || <Box className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold" style={{ color: tc.textPrimary }}>{selectedEquipment.name}</h3>
                    </div>
                  </div>

                  <p className="mb-4" style={{ color: tc.textSecondary }}>
                    Are you sure you want to delete this equipment? This action cannot be undone.
                  </p>

                  {selectedEquipment.schedules.length > 0 && (
                    <div className="rounded-lg p-3 mb-4" style={{
                      background: tc.statusPending.bg,
                      border: '1px solid ' + tc.statusPending.border,
                    }}>
                      <p className="text-sm" style={{ color: tc.statusPending.text }}>
                        This equipment has {selectedEquipment.schedules.length} active schedule(s) that will also be deleted.
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
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ color: tc.textMuted }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteEquipment}
                    disabled={isSubmitting}
                    className="px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    style={{
                      background: tc.btnDangerBg,
                      color: tc.btnDangerText,
                      border: '1px solid ' + tc.btnDangerBorder,
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(239,68,68,0.2)', borderTopColor: tc.accentRed }}
                        />
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
