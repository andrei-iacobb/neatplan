'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeUp, enter } from '@/lib/motion'
import {
  Plus, Search, Filter, Edit, Trash2, Calendar,
  Wrench, CheckCircle, X,
  HeartHandshake, Sparkles, Box, Check, PackageOpen
} from 'lucide-react'
import { apiRequest } from '@/lib/url-utils'
import { PageLoading, Spinner } from '@/components/ui/loading'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useToast } from '@/components/ui/toast-context'
import { canAccessAllSites } from '@/lib/roles'
import type { PlacementSuggestion } from '@/lib/equipment-placement'
import { ExportMenu } from '@/components/export/export-menu'
import { LabelActions } from '@/components/export/label-actions'
import { EquipmentPhotos } from '@/components/admin/equipment-photos'

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
  siteId?: string | null
  site?: { id: string; name: string } | null
  serviceAreaId?: string | null
  serviceArea?: { id: string; name: string; floor: string | null } | null
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
  assetCode?: string
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
  SEMIANNUAL = 'SEMIANNUAL',
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
  siteId: string
  assetCode?: string
  model?: string
  serialNumber?: string
  serviceAreaId: string
}

interface Site {
  id: string
  name: string
}

interface ServiceArea {
  id: string
  name: string
  description?: string | null
  floor?: string | null
  siteId?: string | null
}

const equipmentTypeIcons: { [key: string]: React.ReactNode } = {
  RESIDENT_AID: <HeartHandshake className="w-6 h-6" />,
  WHEELCHAIR: <HeartHandshake className="w-6 h-6" />,
  PATIENT_LIFT: <Wrench className="w-6 h-6" />,
  CLEANING_TROLLEY: <Sparkles className="w-6 h-6" />,
  CLEANING_EQUIPMENT: <Sparkles className="w-6 h-6" />,
  OTHER: <Box className="w-6 h-6" />
}

const equipmentTypes = [
  { value: 'RESIDENT_AID', label: 'Resident Aid' },
  { value: 'WHEELCHAIR', label: 'Wheelchair' },
  { value: 'PATIENT_LIFT', label: 'Patient Lift or Hoist' },
  { value: 'CLEANING_TROLLEY', label: 'Cleaning Trolley' },
  { value: 'CLEANING_EQUIPMENT', label: 'Cleaning Equipment' },
  { value: 'OTHER', label: 'Other' }
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPlacementSuggestion(value: unknown): value is PlacementSuggestion {
  if (!isRecord(value)) return false
  const validType = value.suggestedType === 'RESIDENT_AID' || value.suggestedType === 'WHEELCHAIR' ||
    value.suggestedType === 'PATIENT_LIFT' || value.suggestedType === 'CLEANING_TROLLEY' ||
    value.suggestedType === 'CLEANING_EQUIPMENT' || value.suggestedType === 'OTHER'
  const validCategory = value.category === 'CLEANING' || value.category === 'MOBILITY_AND_LIFTING' ||
    value.category === 'RESIDENT_SUPPORT' || value.category === 'GENERAL'
  const validConfidence = value.confidence === 'HIGH' || value.confidence === 'MEDIUM' || value.confidence === 'LOW'
  const validSource = value.source === 'RULES' || value.source === 'AI'

  return validType && validCategory && validConfidence && validSource &&
    typeof value.suggestedTypeLabel === 'string' && typeof value.categoryLabel === 'string' &&
    (typeof value.serviceAreaId === 'string' || value.serviceAreaId === null) &&
    (typeof value.serviceAreaName === 'string' || value.serviceAreaName === null) &&
    typeof value.reason === 'string' && typeof value.requiresReview === 'boolean'
}

type ThemeColors = ReturnType<typeof useThemeColors>

function getStatusStyle(status: string, tc: ThemeColors) {
  switch (status) {
    case 'COMPLETED': return tc.statusCompleted
    case 'OVERDUE': return tc.statusOverdue
    case 'PENDING': return tc.statusPending
    default: return { bg: tc.surfaceBg, text: tc.textMuted, border: tc.cardBorder }
  }
}

export default function EquipmentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const tc = useThemeColors()
  const { showToast } = useToast()
  // OP/DIRECTOR span every site and pick which one equipment belongs to;
  // Site-based operational roles are pinned, so the server forces their site.
  const canPickSite = canAccessAllSites((session?.user as any)?.role)
  const [sites, setSites] = useState<Site[]>([])
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('EQUIPMENT')
  const [siteFilter, setSiteFilter] = useState<string>('ALL')
  const [assignMode, setAssignMode] = useState<AssignMode>('QUICK')
  const [selectedSchedule, setSelectedSchedule] = useState<string>('')
  const [selectedFrequency, setSelectedFrequency] = useState<ScheduleFrequency>(ScheduleFrequency.WEEKLY)
  const [selectedEquipmentType, setSelectedEquipmentType] = useState<string>('OTHER')
  // Which items of the chosen type actually get the schedule. Picking a type selects all
  // of them, then you untick the exceptions - having five hoists but only needing three
  // on the rota should not force you into the one-by-one Manual tab.
  const [excludedEquipmentIds, setExcludedEquipmentIds] = useState<Set<string>>(new Set())
  const [isAssigning, setIsAssigning] = useState(false)
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  const [placementSuggestion, setPlacementSuggestion] = useState<PlacementSuggestion | null>(null)
  const [isSuggestingPlacement, setIsSuggestingPlacement] = useState(false)
  const placementRequestRef = useRef(0)
  const placementBusyRef = useRef(false)
  const storageChoiceVersionRef = useRef(0)
  const categoryChoiceVersionRef = useRef(0)

  const [formData, setFormData] = useState<EquipmentFormData>({
    name: '',
    description: '',
    type: 'OTHER',
    siteId: '',
    assetCode: '',
    model: '',
    serialNumber: '',
    serviceAreaId: '',
  })

  useEffect(() => {
    apiRequest('/api/sites')
      .then(res => res.json())
      .then(data => setSites(Array.isArray(data) ? data : []))
      .catch(() => setSites([]))
  }, [])

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
        apiRequest('/api/schedules').then(res => res.json()),
        apiRequest('/api/rooms').then(res => res.json()),
      ]).then(([equipmentData, schedulesData, roomsData]) => {
        setEquipment(equipmentData.equipment)
        setSchedules(schedulesData)
        setServiceAreas(Array.isArray(roomsData) ? roomsData.filter((room: ServiceArea & { type?: string }) => room.type === 'SERVICE_AREA') : [])
        setIsLoading(false)
      }).catch(error => {
        console.error('Error fetching data:', error)
        showToast('Failed to load data', 'error')
        setIsLoading(false)
      })
    }
  }, [status, session, router])

  // Land on a type that actually has equipment. Defaulting to OTHER meant opening Quick
  // Assign to an empty picker even when there was plenty of equipment under another type.
  useEffect(() => {
    if (equipment.length === 0) return
    if (equipment.some((e) => e.type === selectedEquipmentType)) return
    const firstPopulated = equipmentTypes.find((t) => equipment.some((e) => e.type === t.value))
    if (firstPopulated) {
      setSelectedEquipmentType(firstPopulated.value)
      setExcludedEquipmentIds(new Set())
    }
  }, [equipment, selectedEquipmentType])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  const resetForm = () => {
    placementRequestRef.current += 1
    placementBusyRef.current = false
    storageChoiceVersionRef.current = 0
    categoryChoiceVersionRef.current = 0
    setPlacementSuggestion(null)
    setIsSuggestingPlacement(false)
    setFormData({
      name: '',
      description: '',
      type: 'OTHER',
      siteId: '',
      assetCode: '',
      model: '',
      serialNumber: '',
      serviceAreaId: '',
    })
  }

  const requestPlacementSuggestion = async (draft = formData, showMissingName = false) => {
    const name = draft.name.trim()
    const siteId = draft.siteId || session?.user?.siteId || ''
    if (!name || !siteId || placementBusyRef.current) {
      if (showMissingName && !name) showToast('Enter the equipment name first', 'error')
      if (showMissingName && !siteId) showToast('Choose a site first', 'error')
      return
    }

    const requestId = ++placementRequestRef.current
    const storageVersion = storageChoiceVersionRef.current
    const categoryVersion = categoryChoiceVersionRef.current
    placementBusyRef.current = true
    setIsSuggestingPlacement(true)
    setPlacementSuggestion(null)
    try {
      const response = await apiRequest('/api/admin/equipment/suggest-placement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: draft.description || null,
          type: draft.type,
          siteId,
        }),
      })
      const data: unknown = await response.json().catch(() => null)
      if (!response.ok || !isPlacementSuggestion(data)) {
        throw new Error(
          isRecord(data) && typeof data.error === 'string'
            ? data.error
            : 'Could not suggest a storage location.',
        )
      }
      if (requestId !== placementRequestRef.current) return

      setPlacementSuggestion(data)
      setFormData((current) => ({
        ...current,
        type:
          categoryVersion === categoryChoiceVersionRef.current && current.type === 'OTHER' && data.confidence !== 'LOW'
            ? data.suggestedType
            : current.type,
        serviceAreaId:
          storageVersion === storageChoiceVersionRef.current && data.serviceAreaId
            ? data.serviceAreaId
            : current.serviceAreaId,
      }))
    } catch (error: unknown) {
      if (requestId === placementRequestRef.current) {
        showToast(error instanceof Error ? error.message : 'Could not suggest a storage location.', 'error')
      }
    } finally {
      if (requestId === placementRequestRef.current) {
        placementBusyRef.current = false
        setIsSuggestingPlacement(false)
      }
    }
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
      showToast('Failed to load equipment', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleQuickAssign() {
    if (!selectedSchedule || !selectedEquipmentType || !selectedFrequency) return

    setIsAssigning(true)
    try {
      // Only the items still ticked, not everything sharing the type.
      const targetEquipment = equipment.filter(
        equip => equip.type === selectedEquipmentType && !excludedEquipmentIds.has(equip.id)
      )
      if (targetEquipment.length === 0) return

      const results = await Promise.all(
        targetEquipment.map(equip =>
          apiRequest(`/api/admin/equipment/${equip.id}/schedules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scheduleId: selectedSchedule,
              frequency: selectedFrequency
            })
          })
            .then(res => res.ok)
            .catch(() => false)
        )
      )

      // These POSTs used to be fired and never checked, so a failed assignment still
      // reported success and the item silently had no schedule.
      const failed = results.filter(ok => !ok).length
      if (failed === results.length) {
        showToast('Could not assign the schedule to any of the selected equipment', 'error')
      } else if (failed > 0) {
        showToast(`Assigned to ${results.length - failed}, but ${failed} failed`, 'error')
      } else {
        setSuccessMessage(
          `Schedule assigned to ${results.length} ${results.length === 1 ? 'item' : 'items'}`
        )
      }

      setSelectedSchedule('')
      setSelectedFrequency(ScheduleFrequency.WEEKLY)
      setExcludedEquipmentIds(new Set())
      fetchEquipment()
    } catch (error) {
      console.error('Error assigning schedules:', error)
      showToast('Failed to assign schedules', 'error')
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
      showToast('Failed to assign schedule', 'error')
    } finally {
      setIsAssigning(false)
    }
  }

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    if (canPickSite && !formData.siteId) {
      showToast('Select a site for this equipment', 'error')
      return
    }

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
      showToast(error.message, 'error')
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
      showToast(error.message, 'error')
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
      showToast(error.message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEditModal = (equip: Equipment) => {
    placementRequestRef.current += 1
    placementBusyRef.current = false
    storageChoiceVersionRef.current += 1
    categoryChoiceVersionRef.current += 1
    setPlacementSuggestion(null)
    setSelectedEquipment(equip)
    setFormData({
      name: equip.name,
      description: equip.description || '',
      type: equip.type,
      siteId: equip.siteId || '',
      assetCode: equip.assetCode || '',
      model: equip.model || '',
      serialNumber: equip.serialNumber || '',
      serviceAreaId: equip.serviceAreaId || '',
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
                         (equip.model && equip.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (equip.serviceArea?.name.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    const matchesType = typeFilter === 'all' || equip.type === typeFilter
    const matchesSite = !canPickSite || siteFilter === 'ALL' || equip.siteId === siteFilter

    return matchesSearch && matchesType && matchesSite
  })

  const formSiteId = formData.siteId || session?.user?.siteId || ''
  const availableServiceAreas = serviceAreas.filter((area) => area.siteId === formSiteId)

  if (status === 'loading' || isLoading) {
    return (
      <div className="max-w-[1300px] mx-auto relative z-10 pb-8">
        <PageLoading cards={6} label="Loading equipment" />
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
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4" style={{ color: 'rgb(16,185,129)' }} />
            <p className="text-[13px] font-medium tracking-wide uppercase" style={{ color: tc.accentLabel }}>Equipment</p>
          </div>
          <h1 className="text-[32px] font-bold tracking-tight mb-1" style={{ color: tc.textPrimary }}>Equipment Management</h1>
          <p className="text-[15px]" style={{ color: tc.textMuted }}>Manage maintenance equipment and schedules</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewMode !== 'SCHEDULES' && <LabelActions kind="equipment" site={siteFilter} />}
          <ExportMenu
            dataset={viewMode === 'SCHEDULES' ? 'schedules' : 'equipment'}
            filters={{ site: siteFilter, type: typeFilter, q: searchTerm }}
          />
        </div>
      </div>

      {/* Controls */}
      <motion.div {...fadeUp} transition={enter()} className="flex flex-wrap justify-between items-center gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setViewMode('EQUIPMENT')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200"
            style={viewMode === 'EQUIPMENT'
              ? { background: tc.tabActiveBg, color: tc.tabActiveText, border: '1px solid ' + tc.tabActiveBorder }
              : { background: tc.tabInactiveBg, color: tc.tabInactiveText, border: '1px solid transparent' }
            }
            onMouseEnter={(e) => { if (viewMode !== 'EQUIPMENT') { e.currentTarget.style.background = tc.tabInactiveHoverBg; e.currentTarget.style.color = tc.tabInactiveHoverText } }}
            onMouseLeave={(e) => { if (viewMode !== 'EQUIPMENT') { e.currentTarget.style.background = tc.tabInactiveBg; e.currentTarget.style.color = tc.tabInactiveText } }}
          >
            <Wrench className="w-3.5 h-3.5" />
            Equipment
          </button>
        </div>
        <div className="flex items-center gap-2">
          {canPickSite && sites.length > 0 && viewMode !== 'SCHEDULES' && (
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-[13px] font-medium outline-hidden transition-colors"
              style={{ background: tc.tabInactiveBg, color: tc.tabInactiveText, border: '1px solid ' + tc.inputBorder }}
              aria-label="Filter equipment by site"
            >
              <option value="ALL">All sites</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button
            onClick={() => setViewMode('SCHEDULES')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.97]"
            style={viewMode === 'SCHEDULES'
              ? { background: tc.tabActiveBg, color: tc.tabActiveText, border: '1px solid ' + tc.tabActiveBorder }
              : { background: tc.tabInactiveBg, color: tc.tabInactiveText, border: '1px solid transparent' }
            }
            onMouseEnter={(e) => { if (viewMode !== 'SCHEDULES') { e.currentTarget.style.background = tc.tabInactiveHoverBg; e.currentTarget.style.color = tc.tabInactiveHoverText } }}
            onMouseLeave={(e) => { if (viewMode !== 'SCHEDULES') { e.currentTarget.style.background = tc.tabInactiveBg; e.currentTarget.style.color = tc.tabInactiveText } }}
            aria-pressed={viewMode === 'SCHEDULES'}
          >
            <Calendar className="w-3.5 h-3.5" />
            Assign Schedules
          </button>
          {viewMode !== 'SCHEDULES' && (
            <button
              onClick={() => { resetForm(); setShowAddModal(true) }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-[0.97]"
              style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: '1px solid ' + tc.btnPrimaryBorder }}
              onMouseEnter={(e) => { e.currentTarget.style.background = tc.btnPrimaryHoverBg }}
              onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnPrimaryBg }}
            >
              <Plus className="w-4 h-4" />
              Add Equipment
            </button>
          )}
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div {...fadeUp} transition={enter(1)} className="rounded-xl p-4 mb-6" style={{ background: tc.cardBg, border: '1px solid ' + tc.cardBorder, boxShadow: tc.shadow }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: tc.textFaint }} />
            <input
              type="text"
              placeholder="Search equipment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm outline-hidden"
              style={inputStyle}
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by equipment category"
            className="px-4 py-2 rounded-lg text-sm outline-hidden"
            style={selectStyle}
          >
            <option value="all">All Categories</option>
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
        <motion.div {...fadeUp} transition={enter(2)} className="mb-8">
          <h2 className="text-xl font-semibold mb-6" style={{ color: tc.textPrimary }}>Schedule Assignment</h2>

          {/* Assignment Mode Toggle */}
          {/* One segmented control rather than two free-floating buttons, so the pair
              reads as a single choice with two positions. */}
          <div
            role="tablist"
            aria-label="Assignment mode"
            className="inline-flex p-1 rounded-xl mb-6"
            style={{ background: tc.surfaceBg, border: '1px solid ' + tc.cardBorder }}
          >
            {(['QUICK', 'MANUAL'] as AssignMode[]).map((mode) => {
              const active = assignMode === mode
              return (
                <button
                  key={mode}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setAssignMode(mode)}
                  className="px-4 min-h-[36px] rounded-lg text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  style={active ? {
                    background: tc.cardBg,
                    color: tc.textPrimary,
                    boxShadow: tc.shadow,
                  } : {
                    background: 'transparent',
                    color: tc.textMuted,
                  }}
                >
                  {mode === 'QUICK' ? 'Quick Assign' : 'Manual Assign'}
                </button>
              )
            })}
          </div>

          {assignMode === 'QUICK' && (
            <div className="rounded-xl p-6 mb-6" style={{ background: tc.cardBg, border: '1px solid ' + tc.cardBorder, boxShadow: tc.shadow }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color: tc.textPrimary }}>Quick Assignment</h3>
              <p className="text-sm mb-4" style={{ color: tc.textMuted }}>Pick a category to select its equipment, then untick anything that should not get this schedule</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>Schedule</label>
                  <select
                    value={selectedSchedule}
                    onChange={(e) => handleScheduleSelection(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
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
                  <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>Equipment Category</label>
                  <select
                    value={selectedEquipmentType}
                    onChange={(e) => {
                      setSelectedEquipmentType(e.target.value)
                      // A new type starts with everything ticked.
                      setExcludedEquipmentIds(new Set())
                    }}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
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
                    className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
                    style={selectStyle}
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Bi-weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="SEMIANNUAL">Six Monthly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>
              </div>

              {(() => {
                const ofType = equipment.filter((e) => e.type === selectedEquipmentType)
                const chosen = ofType.filter((e) => !excludedEquipmentIds.has(e.id))
                const typeLabel = equipmentTypes.find((t) => t.value === selectedEquipmentType)?.label
                  ?? selectedEquipmentType.replace('_', ' ')

                if (ofType.length === 0) {
                  return (
                    <div
                      className="rounded-xl p-4 mb-5 text-sm"
                      style={{ background: tc.surfaceBg, color: tc.textMuted, border: '1px solid ' + tc.cardBorder }}
                    >
                      No {typeLabel.toLowerCase()} equipment yet. Add some above and it will appear here to pick from.
                    </div>
                  )
                }

                return (
                  <div
                    className="rounded-xl p-4 mb-5"
                    style={{ background: tc.surfaceBg, border: '1px solid ' + tc.cardBorder }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-3">
                      <label className="text-sm font-medium" style={{ color: tc.textSecondary }}>
                        Apply to
                        <span className="ml-2 font-normal tabular-nums" style={{ color: tc.textMuted }}>
                          {chosen.length} of {ofType.length} selected
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setExcludedEquipmentIds(
                            chosen.length === ofType.length ? new Set(ofType.map((e) => e.id)) : new Set()
                          )
                        }
                        className="text-[12px] font-medium rounded-sm px-2 py-1 shrink-0 whitespace-nowrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                        style={{ color: tc.accentGreen }}
                      >
                        {chosen.length === ofType.length ? 'Clear all' : 'Select all'}
                      </button>
                    </div>

                    <ul className="flex flex-wrap gap-2" role="group" aria-label={`${typeLabel} equipment to assign`}>
                      {ofType.map((item) => {
                        const on = !excludedEquipmentIds.has(item.id)
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              onClick={() =>
                                setExcludedEquipmentIds((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(item.id)) next.delete(item.id)
                                  else next.add(item.id)
                                  return next
                                })
                              }
                              className="flex items-center gap-2 min-h-[40px] px-3 rounded-lg text-[13px] transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                              style={{
                                // Selected pills stay neutral. They used to carry the same
                                // mint as the primary button (0.08 vs 0.10 alpha of one
                                // colour), so a dozen chips drowned out the one control that
                                // actually does something. Only the checkbox is accented.
                                background: tc.cardBg,
                                color: on ? tc.textPrimary : tc.textMuted,
                                border: '1px solid ' + (on ? tc.cardBorder : 'transparent'),
                                opacity: on ? 1 : 0.6,
                              }}
                            >
                              <span
                                aria-hidden="true"
                                className="flex items-center justify-center w-[18px] h-[18px] rounded-[5px] shrink-0 transition-colors"
                                style={{
                                  background: on ? tc.accentGreen : 'transparent',
                                  border: '1px solid ' + (on ? tc.accentGreen : tc.textFaint),
                                }}
                              >
                                {on && <Check className="w-3 h-3" strokeWidth={3} style={{ color: tc.cardBg }} />}
                              </span>
                              {item.name}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })()}

              <button
                onClick={handleQuickAssign}
                disabled={
                  !selectedSchedule ||
                  !selectedEquipmentType ||
                  isAssigning ||
                  equipment.filter((e) => e.type === selectedEquipmentType && !excludedEquipmentIds.has(e.id)).length === 0
                }
                className="flex items-center px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{
                  background: tc.btnPrimaryBg,
                  color: tc.btnPrimaryText,
                  border: '1px solid ' + tc.btnPrimaryBorder,
                }}
              >
                {isAssigning ? (
                  <Spinner size="sm" className="mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                {(() => {
                  const n = equipment.filter(
                    (e) => e.type === selectedEquipmentType && !excludedEquipmentIds.has(e.id)
                  ).length
                  return `Assign to ${n} selected ${n === 1 ? 'item' : 'items'}`
                })()}
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
                    className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
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
                    className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
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
                    className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
                    style={selectStyle}
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="BIWEEKLY">Bi-weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="SEMIANNUAL">Six Monthly</option>
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
                  <Spinner size="sm" className="mr-2" />
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
        <motion.div {...fadeUp} transition={enter(2)} className="text-center py-16 rounded-xl" style={{ background: tc.emptyBg, border: '1px solid ' + tc.cardBorder }}>
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
              transition={enter(2 + index)}
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
                    {equip.assetCode && (
                      <div className="text-xs font-mono px-2 py-1 rounded-sm mt-1" style={{ background: tc.surfaceBg, color: tc.accentGreen, border: `1px solid ${tc.accentGreen}` }}>
                        {equip.assetCode}
                      </div>
                    )}
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
                        <span style={{ color: tc.textMuted }}>Category:</span>
                  <span className="ml-2" style={{ color: tc.textSecondary }}>{equip.type.replace('_', ' ')}</span>
                </div>
                {canPickSite && equip.site && (
                  <div className="text-sm">
                    <span style={{ color: tc.textMuted }}>Site:</span>
                    <span className="ml-2" style={{ color: tc.textSecondary }}>{equip.site.name}</span>
                  </div>
                )}
                {equip.serviceArea && (
                  <div className="flex items-center gap-2 text-sm">
                    <PackageOpen className="h-4 w-4" style={{ color: tc.accentGreen }} aria-hidden="true" />
                    <span style={{ color: tc.textMuted }}>Stored in:</span>
                    <span style={{ color: tc.textSecondary }}>{equip.serviceArea.name}{equip.serviceArea.floor ? ` · ${equip.serviceArea.floor}` : ''}</span>
                  </div>
                )}
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
                    type="button"
                    aria-label="Close add equipment form"
                    onClick={() => setShowAddModal(false)}
                    className="p-1 rounded-md transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                    style={{ color: tc.textMuted }}
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>

                <form onSubmit={handleAddEquipment} className="space-y-4">
                  {canPickSite && (
                    <div>
                      <label htmlFor="add-equipment-site" className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                        Site *
                      </label>
                      <select
                        id="add-equipment-site"
                        name="siteId"
                        value={formData.siteId}
                        onChange={(e) => {
                          placementRequestRef.current += 1
                          placementBusyRef.current = false
                          storageChoiceVersionRef.current = 0
                          setPlacementSuggestion(null)
                          setIsSuggestingPlacement(false)
                          setFormData({ ...formData, siteId: e.target.value, serviceAreaId: '' })
                        }}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
                        style={selectStyle}
                      >
                        <option value="">Select a site...</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label htmlFor="add-equipment-name" className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Name *
                    </label>
                    <input
                      id="add-equipment-name"
                      name="equipmentName"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => {
                        placementRequestRef.current += 1
                        placementBusyRef.current = false
                        setPlacementSuggestion(null)
                        setIsSuggestingPlacement(false)
                        setFormData({
                          ...formData,
                          name: e.target.value,
                          serviceAreaId: storageChoiceVersionRef.current === 0 ? '' : formData.serviceAreaId,
                        })
                      }}
                      onBlur={() => {
                        if (!formData.serviceAreaId && storageChoiceVersionRef.current === 0) {
                          void requestPlacementSuggestion()
                        }
                      }}
                      autoComplete="off"
                      maxLength={200}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
                      style={inputStyle}
                      placeholder="e.g. Mobile hoist…"
                    />
                  </div>

                  <div>
                    <label htmlFor="add-equipment-category" className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Category
                    </label>
                    <select
                      id="add-equipment-category"
                      name="equipmentType"
                      value={formData.type}
                      onChange={(e) => {
                        placementRequestRef.current += 1
                        placementBusyRef.current = false
                        categoryChoiceVersionRef.current += 1
                        setPlacementSuggestion(null)
                        setIsSuggestingPlacement(false)
                        setFormData({
                          ...formData,
                          type: e.target.value,
                          serviceAreaId: storageChoiceVersionRef.current === 0 ? '' : formData.serviceAreaId,
                        })
                      }}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
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
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label htmlFor="add-service-area" className="flex items-center gap-2 text-sm font-medium" style={{ color: tc.textSecondary }}>
                        <PackageOpen className="h-4 w-4" aria-hidden="true" /> Stored in
                      </label>
                      <button
                        type="button"
                        onClick={() => void requestPlacementSuggestion(formData, true)}
                        disabled={isSuggestingPlacement || !formData.name.trim() || !formSiteId}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-50"
                        style={{ background: tc.btnSecondaryBg, color: tc.btnSecondaryText, border: `1px solid ${tc.btnSecondaryBorder}` }}
                      >
                        {isSuggestingPlacement ? <Spinner size="sm" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                        {isSuggestingPlacement ? 'Finding Best Fit…' : 'Suggest Best Fit'}
                      </button>
                    </div>
                    <select
                      id="add-service-area"
                      name="serviceAreaId"
                      value={formData.serviceAreaId}
                      onChange={(e) => {
                        placementRequestRef.current += 1
                        placementBusyRef.current = false
                        storageChoiceVersionRef.current += 1
                        setPlacementSuggestion(null)
                        setIsSuggestingPlacement(false)
                        setFormData({ ...formData, serviceAreaId: e.target.value })
                      }}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
                      style={selectStyle}
                    >
                      <option value="">Mobile or unassigned</option>
                      {availableServiceAreas.map((area) => (
                        <option key={area.id} value={area.id}>{area.name}{area.floor ? ` · ${area.floor}` : ''}</option>
                      ))}
                    </select>
                    <PlacementSuggestionNotice suggestion={placementSuggestion} tc={tc} />
                    {!placementSuggestion && !isSuggestingPlacement && (
                      <p className="mt-1.5 text-xs" style={{ color: tc.textMuted }}>The app suggests a category and best-fit service area. You can always change either choice.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-hidden resize-none"
                      style={inputStyle}
                      placeholder="Enter description"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Asset Code
                    </label>
                    <input
                      type="text"
                      value={formData.assetCode || ''}
                      onChange={(e) => setFormData({ ...formData, assetCode: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
                      style={inputStyle}
                      placeholder="e.g., HT-001, WC-042"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Model
                    </label>
                    <input
                      type="text"
                      value={formData.model || ''}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
                      style={inputStyle}
                      placeholder="Equipment model"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Serial Number
                    </label>
                    <input
                      type="text"
                      value={formData.serialNumber || ''}
                      onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
                      style={inputStyle}
                      placeholder="Serial number"
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
                          <Spinner size="sm" />
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
                    type="button"
                    aria-label="Close edit equipment form"
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedEquipment(null)
                      resetForm()
                    }}
                    className="p-1 rounded-md transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                    style={{ color: tc.textMuted }}
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>

                <form onSubmit={handleEditEquipment} className="space-y-4">
                  {canPickSite && (
                    <div>
                      <label htmlFor="edit-equipment-site" className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                        Site *
                      </label>
                      <select
                        id="edit-equipment-site"
                        name="siteId"
                        value={formData.siteId}
                        onChange={(e) => {
                          placementRequestRef.current += 1
                          placementBusyRef.current = false
                          storageChoiceVersionRef.current += 1
                          setPlacementSuggestion(null)
                          setIsSuggestingPlacement(false)
                          setFormData({ ...formData, siteId: e.target.value, serviceAreaId: '' })
                        }}
                        className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
                        style={selectStyle}
                      >
                        <option value="">Select a site...</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label htmlFor="edit-equipment-name" className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Name *
                    </label>
                    <input
                      id="edit-equipment-name"
                      name="equipmentName"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => {
                        placementRequestRef.current += 1
                        placementBusyRef.current = false
                        setPlacementSuggestion(null)
                        setIsSuggestingPlacement(false)
                        setFormData({ ...formData, name: e.target.value })
                      }}
                      autoComplete="off"
                      maxLength={200}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
                      style={inputStyle}
                      placeholder="e.g. Mobile hoist…"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-equipment-category" className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Category
                    </label>
                    <select
                      id="edit-equipment-category"
                      name="equipmentType"
                      value={formData.type}
                      onChange={(e) => {
                        placementRequestRef.current += 1
                        placementBusyRef.current = false
                        categoryChoiceVersionRef.current += 1
                        setPlacementSuggestion(null)
                        setIsSuggestingPlacement(false)
                        setFormData({ ...formData, type: e.target.value })
                      }}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
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
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label htmlFor="edit-service-area" className="flex items-center gap-2 text-sm font-medium" style={{ color: tc.textSecondary }}>
                        <PackageOpen className="h-4 w-4" aria-hidden="true" /> Stored in
                      </label>
                      <button
                        type="button"
                        onClick={() => void requestPlacementSuggestion(formData, true)}
                        disabled={isSuggestingPlacement || !formData.name.trim() || !formSiteId}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-[opacity,transform] hover:opacity-90 active:scale-[0.97] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-50"
                        style={{ background: tc.btnSecondaryBg, color: tc.btnSecondaryText, border: `1px solid ${tc.btnSecondaryBorder}` }}
                      >
                        {isSuggestingPlacement ? <Spinner size="sm" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
                        {isSuggestingPlacement ? 'Finding Best Fit…' : 'Suggest Best Fit'}
                      </button>
                    </div>
                    <select
                      id="edit-service-area"
                      name="serviceAreaId"
                      value={formData.serviceAreaId}
                      onChange={(e) => {
                        placementRequestRef.current += 1
                        placementBusyRef.current = false
                        storageChoiceVersionRef.current += 1
                        setPlacementSuggestion(null)
                        setIsSuggestingPlacement(false)
                        setFormData({ ...formData, serviceAreaId: e.target.value })
                      }}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
                      style={selectStyle}
                    >
                      <option value="">Mobile or unassigned</option>
                      {availableServiceAreas.map((area) => (
                        <option key={area.id} value={area.id}>{area.name}{area.floor ? ` · ${area.floor}` : ''}</option>
                      ))}
                    </select>
                    <PlacementSuggestionNotice suggestion={placementSuggestion} tc={tc} />
                    {!placementSuggestion && !isSuggestingPlacement && (
                      <p className="mt-1.5 text-xs" style={{ color: tc.textMuted }}>Request a best fit, then keep it or choose another service area manually.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-hidden resize-none"
                      style={inputStyle}
                      placeholder="Enter description"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Asset Code
                    </label>
                    <input
                      type="text"
                      value={formData.assetCode || ''}
                      onChange={(e) => setFormData({ ...formData, assetCode: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
                      style={inputStyle}
                      placeholder="e.g., HT-001, WC-042"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Model
                    </label>
                    <input
                      type="text"
                      value={formData.model || ''}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
                      style={inputStyle}
                      placeholder="Equipment model"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Serial Number
                    </label>
                    <input
                      type="text"
                      value={formData.serialNumber || ''}
                      onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-hidden"
                      style={inputStyle}
                      placeholder="Serial number"
                    />
                  </div>


                  {/* Optional, and deliberately above the label block: telling two
                      identical hoists apart is the everyday need, replacing a
                      sticker is the rare one. */}
                  <div className="pt-4" style={{ borderTop: '1px solid ' + tc.divider }}>
                    <p className="mb-2 pt-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: tc.textMuted }}>
                      Identification photos
                    </p>
                    <EquipmentPhotos
                      equipmentId={selectedEquipment.id}
                      equipmentName={selectedEquipment.name}
                    />
                  </div>

                  {/* The asset tag travels with the item, so it is managed here. */}
                  <div className="pt-4" style={{ borderTop: '1px solid ' + tc.divider }}>
                    <p className="mb-2 pt-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: tc.textMuted }}>
                      Asset label
                    </p>
                    <LabelActions
                      kind="equipment"
                      id={selectedEquipment.id}
                      name={selectedEquipment.name}
                      size="sm"
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
                          <Spinner size="sm" />
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
                    type="button"
                    aria-label="Close delete equipment confirmation"
                    onClick={() => {
                      setShowDeleteModal(false)
                      setSelectedEquipment(null)
                    }}
                    className="p-1 rounded-md transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                    style={{ color: tc.textMuted }}
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
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
                        <Spinner size="sm" />
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

function PlacementSuggestionNotice({
  suggestion,
  tc,
}: {
  suggestion: PlacementSuggestion | null
  tc: ThemeColors
}) {
  if (!suggestion) return null
  const tone = suggestion.requiresReview ? tc.statusPending : tc.statusCompleted
  const sourceLabel = suggestion.source === 'AI' ? 'AI suggestion' : 'Category match'
  const placement = suggestion.serviceAreaName ?? 'No confident storage match'

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-2 break-words rounded-lg px-3 py-2.5 text-xs leading-relaxed"
      style={{ background: tone.bg, color: tone.text, border: `1px solid ${tone.border}` }}
    >
      <p className="font-semibold">
        {sourceLabel}: {suggestion.suggestedTypeLabel} · {placement}
      </p>
      <p className="mt-0.5">
        {suggestion.confidence.toLocaleLowerCase('en-GB')} confidence · {suggestion.reason}
      </p>
      {suggestion.requiresReview && (
        <p className="mt-1 font-medium">Review the category and storage choice before saving.</p>
      )}
    </div>
  )
}
