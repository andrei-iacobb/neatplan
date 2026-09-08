"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  ImageUp,
  Loader2,
  MapPinned,
  MousePointer2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react'
import { apiRequest } from '@/lib/url-utils'
import { canAccessAllSites } from '@/lib/roles'
import { useToast } from '@/components/ui/toast-context'

type Site = { id: string; name: string }
type Room = { id: string; name: string; floor: string | null; type: string; siteId: string | null }
type FloorPlanRegion = {
  id: string
  label: string
  roomId: string | null
  x: number
  y: number
  width: number
  height: number
  room: { id: string; name: string; floor: string | null; type: string } | null
}
type FloorPlan = {
  id: string
  name: string
  floor: string
  siteId: string
  site: Site
  imageUrl: string
  imageWidth: number
  imageHeight: number
  sourceFileName: string
  isPublished: boolean
  revision: number
  updatedAt: string
  regions: FloorPlanRegion[]
}

type RegionDrag = {
  pointerId: number
  regionId: string
  startClientX: number
  startClientY: number
  startRegionX: number
  startRegionY: number
  hasMoved: boolean
}

async function responseError(response: Response, fallback: string): Promise<string> {
  const body: unknown = await response.json().catch(() => null)
  if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') return body.error
  return fallback
}

function clampRegionPosition(value: number, size: number): number {
  return Math.max(0, Math.min(1 - size, value - size / 2))
}

export default function FloorPlansPage() {
  const { data: session, status } = useSession()
  const { showToast } = useToast()
  const canPickSite = canAccessAllSites(session?.user?.role)
  const [sites, setSites] = useState<Site[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [plans, setPlans] = useState<FloorPlan[]>([])
  const [siteId, setSiteId] = useState('')
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [workingRegions, setWorkingRegions] = useState<FloorPlanRegion[]>([])
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [roomToPlace, setRoomToPlace] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isReplacing, setIsReplacing] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newPlan, setNewPlan] = useState({ name: '', floor: 'Ground Floor', file: null as File | null })
  const regionDragRef = useRef<RegionDrag | null>(null)
  const isBusy = isSaving || isCreating || isReplacing

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null
  const visiblePlans = plans.filter((plan) => !siteId || plan.siteId === siteId)
  const siteRooms = rooms.filter((room) => room.siteId === (selectedPlan?.siteId || siteId))

  const sortedRooms = useMemo(() => [...siteRooms].sort((a, b) => {
    const aMatchesFloor = a.floor === selectedPlan?.floor ? 0 : 1
    const bMatchesFloor = b.floor === selectedPlan?.floor ? 0 : 1
    return aMatchesFloor - bMatchesFloor || a.name.localeCompare(b.name)
  }), [siteRooms, selectedPlan?.floor])

  const selectedRegion = workingRegions.find((region) => region.id === selectedRegionId) ?? null
  const mappedRoomIds = new Set(workingRegions.flatMap((region) => region.roomId ? [region.roomId] : []))
  const roomsAvailableToPlace = sortedRooms.filter((room) => !mappedRoomIds.has(room.id))
  const publishIssue = workingRegions.length === 0
    ? 'Add at least one room before publishing.'
    : workingRegions.some((region) => !region.roomId)
      ? 'Relink every marked area before publishing.'
      : isDirty
        ? 'Save the draft before publishing.'
        : null

  const loadData = async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [sitesResponse, roomsResponse, plansResponse] = await Promise.all([
        apiRequest('/api/sites'),
        apiRequest('/api/rooms'),
        apiRequest('/api/floor-plans'),
      ])
      if (!sitesResponse.ok || !roomsResponse.ok || !plansResponse.ok) throw new Error('load')
      const [loadedSites, loadedRooms, loadedPlans] = await Promise.all([
        sitesResponse.json() as Promise<Site[]>,
        roomsResponse.json() as Promise<Room[]>,
        plansResponse.json() as Promise<FloorPlan[]>,
      ])
      setSites(loadedSites)
      setRooms(loadedRooms)
      setPlans(loadedPlans)
      const defaultSite = canPickSite ? (siteId || loadedSites[0]?.id || '') : (session?.user?.siteId || '')
      setSiteId(defaultSite)
      const firstPlan = loadedPlans.find((plan) => plan.siteId === defaultSite) ?? null
      setSelectedPlanId(firstPlan?.id ?? null)
      setWorkingRegions(firstPlan?.regions ?? [])
      setSelectedRegionId(null)
      setRoomToPlace('')
      setIsDirty(false)
    } catch {
      setLoadError('Floor plans could not be loaded. Check the connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') void loadData()
    // This page loads once per signed-in identity. Site changes are handled locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session?.user?.id])

  useEffect(() => {
    if (!isDirty) return
    const warnAboutUnsavedChanges = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnAboutUnsavedChanges)
    return () => window.removeEventListener('beforeunload', warnAboutUnsavedChanges)
  }, [isDirty])

  const selectPlan = (plan: FloorPlan) => {
    if (isDirty && !window.confirm('Discard the unsaved room positions on this floor plan?')) return
    setSelectedPlanId(plan.id)
    setWorkingRegions(plan.regions)
    setSelectedRegionId(null)
    setRoomToPlace('')
    setIsDirty(false)
  }

  const updatePlanInState = (planId: string, change: Partial<FloorPlan>) => {
    setPlans((current) => current.map((plan) => plan.id === planId ? { ...plan, ...change } : plan))
  }

  const createPlan = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newPlan.file || !newPlan.name.trim() || !newPlan.floor.trim() || !siteId) {
      showToast('Choose a site, plan name, floor and file', 'error')
      return
    }
    if (isDirty && !window.confirm('Discard the unsaved room positions before uploading another plan?')) return
    setIsCreating(true)
    try {
      const formData = new FormData()
      formData.set('name', newPlan.name.trim())
      formData.set('floor', newPlan.floor.trim())
      formData.set('siteId', siteId)
      formData.set('file', newPlan.file)
      const response = await apiRequest('/api/floor-plans', { method: 'POST', body: formData })
      if (!response.ok) throw new Error(await responseError(response, 'Could not upload the floor plan.'))
      const created = await response.json() as FloorPlan
      setPlans((current) => [...current, created])
      setSelectedPlanId(created.id)
      setWorkingRegions([])
      setSelectedRegionId(null)
      setRoomToPlace('')
      setNewPlan({ name: '', floor: 'Ground Floor', file: null })
      setShowCreate(false)
      setIsDirty(false)
      showToast('Floor plan uploaded. Mark its rooms before publishing.', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not upload the floor plan.', 'error')
    } finally {
      setIsCreating(false)
    }
  }

  const addRoomRegion = (room: Room, pointX: number, pointY: number) => {
    const width = 0.14
    const height = 0.1
    const region: FloorPlanRegion = {
      id: `draft-${crypto.randomUUID()}`,
      label: room.name,
      roomId: room.id,
      x: clampRegionPosition(pointX, width),
      y: clampRegionPosition(pointY, height),
      width,
      height,
      room: { id: room.id, name: room.name, floor: room.floor, type: room.type },
    }
    setWorkingRegions((current) => [...current, region])
    setSelectedRegionId(region.id)
    setRoomToPlace('')
    setIsDirty(true)
  }

  const handlePlanClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedPlan || isBusy) return
    const room = siteRooms.find((candidate) => candidate.id === roomToPlace)
    if (room && !mappedRoomIds.has(room.id)) {
      const bounds = event.currentTarget.getBoundingClientRect()
      const pointX = (event.clientX - bounds.left) / bounds.width
      const pointY = (event.clientY - bounds.top) / bounds.height
      addRoomRegion(room, pointX, pointY)
      return
    }

    setSelectedRegionId(null)
  }

  const beginRegionDrag = (event: React.PointerEvent<HTMLButtonElement>, region: FloorPlanRegion) => {
    if (event.button !== 0 || !event.isPrimary || isBusy) return
    event.stopPropagation()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedRegionId(region.id)
    setRoomToPlace('')
    regionDragRef.current = {
      pointerId: event.pointerId,
      regionId: region.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRegionX: region.x,
      startRegionY: region.y,
      hasMoved: false,
    }
  }

  const dragRegion = (event: React.PointerEvent<HTMLButtonElement>, region: FloorPlanRegion) => {
    if (isBusy) return
    const drag = regionDragRef.current
    if (!drag || drag.pointerId !== event.pointerId || drag.regionId !== region.id) return

    // Four pixels keeps ordinary taps from becoming accidental unsaved moves.
    if (!drag.hasMoved && Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) < 4) return
    const planBounds = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!planBounds) return

    drag.hasMoved = true
    event.preventDefault()
    const nextX = drag.startRegionX + (event.clientX - drag.startClientX) / planBounds.width
    const nextY = drag.startRegionY + (event.clientY - drag.startClientY) / planBounds.height
    setWorkingRegions((current) => current.map((candidate) => candidate.id === region.id ? {
      ...candidate,
      x: Math.max(0, Math.min(1 - candidate.width, nextX)),
      y: Math.max(0, Math.min(1 - candidate.height, nextY)),
    } : candidate))
    setIsDirty(true)
  }

  const endRegionDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (regionDragRef.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    regionDragRef.current = null
  }

  const nudgeRegion = (event: React.KeyboardEvent<HTMLButtonElement>, region: FloorPlanRegion) => {
    if (isBusy) return
    if (event.key === 'Escape') {
      setSelectedRegionId(null)
      event.currentTarget.blur()
      return
    }
    const planBounds = event.currentTarget.parentElement?.getBoundingClientRect()
    if (!planBounds) return

    let nextX = region.x
    let nextY = region.y
    if (event.key === 'ArrowLeft') nextX -= 1 / planBounds.width
    else if (event.key === 'ArrowRight') nextX += 1 / planBounds.width
    else if (event.key === 'ArrowUp') nextY -= 1 / planBounds.height
    else if (event.key === 'ArrowDown') nextY += 1 / planBounds.height
    else return

    event.preventDefault()
    event.stopPropagation()
    nextX = Math.max(0, Math.min(1 - region.width, nextX))
    nextY = Math.max(0, Math.min(1 - region.height, nextY))
    if (nextX === region.x && nextY === region.y) return

    setWorkingRegions((current) => current.map((candidate) => candidate.id === region.id ? {
      ...candidate,
      x: nextX,
      y: nextY,
    } : candidate))
    setSelectedRegionId(region.id)
    setRoomToPlace('')
    setIsDirty(true)
  }

  const patchSelectedRegion = (change: Partial<FloorPlanRegion>) => {
    if (!selectedRegion) return
    setWorkingRegions((current) => current.map((region) => {
      if (region.id !== selectedRegion.id) return region
      const next = { ...region, ...change }
      return {
        ...next,
        x: Math.min(next.x, 1 - next.width),
        y: Math.min(next.y, 1 - next.height),
      }
    }))
    setIsDirty(true)
  }

  const relinkSelectedRegion = (roomId: string) => {
    const room = siteRooms.find((candidate) => candidate.id === roomId)
    if (!room) return
    patchSelectedRegion({
      roomId: room.id,
      label: room.name,
      room: { id: room.id, name: room.name, floor: room.floor, type: room.type },
    })
  }

  const removeSelectedRegion = () => {
    if (!selectedRegion) return
    setWorkingRegions((current) => current.filter((region) => region.id !== selectedRegion.id))
    setSelectedRegionId(null)
    setIsDirty(true)
  }

  const saveDraft = async () => {
    if (!selectedPlan) return false
    setIsSaving(true)
    try {
      const response = await apiRequest(`/api/floor-plans/${selectedPlan.id}/regions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: selectedPlan.revision, regions: workingRegions }),
      })
      if (!response.ok) throw new Error(await responseError(response, 'Could not save the marked rooms.'))
      const saved = await response.json() as Pick<FloorPlan, 'revision' | 'regions' | 'isPublished' | 'updatedAt'>
      setWorkingRegions(saved.regions)
      setSelectedRegionId(null)
      updatePlanInState(selectedPlan.id, saved)
      setIsDirty(false)
      showToast('Draft saved. Publishing is a separate step.', 'success')
      return true
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save the marked rooms.', 'error')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const setPublished = async (publish: boolean) => {
    if (!selectedPlan || (publish && publishIssue)) return
    setIsSaving(true)
    try {
      const response = await apiRequest(`/api/floor-plans/${selectedPlan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: publish ? 'publish' : 'unpublish', revision: selectedPlan.revision }),
      })
      if (!response.ok) throw new Error(await responseError(response, 'Could not update publication.'))
      const updated = await response.json() as Pick<FloorPlan, 'revision' | 'isPublished' | 'updatedAt'>
      updatePlanInState(selectedPlan.id, updated)
      showToast(publish ? 'Floor plan published to the cleaner portal' : 'Floor plan removed from the cleaner portal', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update publication.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const replaceImage = async (file: File | null) => {
    if (!selectedPlan || !file) return
    setIsReplacing(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('revision', String(selectedPlan.revision))
      const response = await apiRequest(`/api/floor-plans/${selectedPlan.id}/image`, { method: 'PUT', body: formData })
      if (!response.ok) throw new Error(await responseError(response, 'Could not replace the floor plan image.'))
      const updated = await response.json() as Partial<FloorPlan>
      updatePlanInState(selectedPlan.id, updated)
      showToast('Plan image replaced. Review the room positions before publishing again.', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not replace the floor plan image.', 'error')
    } finally {
      setIsReplacing(false)
    }
  }

  if (isLoading) {
    return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" aria-label="Loading floor plans" /></div>
  }

  return (
    <fieldset disabled={isBusy} aria-busy={isBusy} className="mx-auto min-w-0 max-w-[1400px] pb-8 text-[rgb(var(--text-secondary))]">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-400">
            <MapPinned className="h-4 w-4" aria-hidden="true" /> Building navigation
          </div>
          <h1 className="text-balance text-[32px] font-bold tracking-[-0.03em] text-[rgb(var(--text-primary))]">Floor plans</h1>
          <p className="mt-1 max-w-2xl text-[14px] text-[rgb(var(--text-muted))]">Upload one plan per floor, mark its rooms, then publish it as the cleaner&apos;s visual work list.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canPickSite && (
            <label className="flex items-center gap-2 text-[13px] font-medium">
              <span>Site</span>
              <select
                name="siteId"
                value={siteId}
                onChange={(event) => {
                  if (isDirty && !window.confirm('Discard the unsaved room positions?')) return
                  const nextSite = event.target.value
                  setSiteId(nextSite)
                  const first = plans.find((plan) => plan.siteId === nextSite) ?? null
                  setSelectedPlanId(first?.id ?? null)
                  setWorkingRegions(first?.regions ?? [])
                  setSelectedRegionId(null)
                  setRoomToPlace('')
                  setIsDirty(false)
                }}
                className="min-h-11 rounded-xl border border-[rgb(var(--control-border))] bg-[rgb(var(--surface))] px-3 text-[14px] text-[rgb(var(--text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={() => setShowCreate((visible) => !visible)}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Add Floor Plan
          </button>
        </div>
      </header>

      {loadError && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-[13px] text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{loadError}</span>
          <button type="button" onClick={() => void loadData()} className="flex min-h-10 items-center gap-2 rounded-lg border border-current px-3 font-semibold"><RefreshCw className="h-4 w-4" /> Retry</button>
        </div>
      )}

      {showCreate && (
        <form onSubmit={createPlan} className="mb-6 grid gap-4 rounded-2xl border border-black/10 bg-[rgb(var(--surface))] p-5 shadow-sm dark:border-white/10 md:grid-cols-[1fr_1fr_1.4fr_auto] md:items-end">
          <label className="grid gap-1.5 text-[12px] font-semibold text-[rgb(var(--text-primary))]">Plan name
            <input name="planName" autoComplete="off" value={newPlan.name} onChange={(event) => setNewPlan((current) => ({ ...current, name: event.target.value }))} required maxLength={100} placeholder="Ground floor plan" className="min-h-12 rounded-xl border border-[rgb(var(--control-border))] bg-[rgb(var(--surface-raised))] px-3 text-[16px] font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50" />
          </label>
          <label className="grid gap-1.5 text-[12px] font-semibold text-[rgb(var(--text-primary))]">Floor label
            <input name="floorLabel" autoComplete="off" value={newPlan.floor} onChange={(event) => setNewPlan((current) => ({ ...current, floor: event.target.value }))} required maxLength={100} className="min-h-12 rounded-xl border border-[rgb(var(--control-border))] bg-[rgb(var(--surface-raised))] px-3 text-[16px] font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50" />
          </label>
          <label className="grid gap-1.5 text-[12px] font-semibold text-[rgb(var(--text-primary))]">PNG, JPEG, WebP or PDF
            <input name="planFile" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" required onChange={(event) => setNewPlan((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} className="min-h-12 rounded-xl border border-[rgb(var(--control-border))] bg-[rgb(var(--surface-raised))] px-3 py-2 text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:font-semibold file:text-white" />
          </label>
          <button disabled={isCreating} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />} Upload Plan
          </button>
        </form>
      )}

      <div className="grid min-h-[650px] gap-4 lg:grid-cols-[250px_minmax(0,1fr)_280px]">
        <aside className="rounded-2xl border border-black/10 bg-[rgb(var(--surface))] p-3 shadow-sm dark:border-white/10" aria-label="Floor plans">
          <div className="mb-2 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[rgb(var(--text-muted))]">Plans at this site</div>
          <div className="grid gap-2">
            {visiblePlans.map((plan) => (
              <button key={plan.id} type="button" onClick={() => selectPlan(plan)} className={`min-h-16 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${selectedPlanId === plan.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-black/10 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.04]'}`}>
                <span className="block truncate text-[14px] font-semibold text-[rgb(var(--text-primary))]">{plan.name}</span>
                <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[rgb(var(--text-muted))]">
                  <span>{plan.floor} · {plan.regions.length} areas</span>
                  <span className={plan.isPublished ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-300'}>{plan.isPublished ? 'Published' : 'Draft'}</span>
                </span>
              </button>
            ))}
          </div>
          {visiblePlans.length === 0 && <div className="rounded-xl border border-dashed border-black/15 p-5 text-center text-[13px] text-[rgb(var(--text-muted))] dark:border-white/15">No plans yet. Upload the first floor to begin.</div>}
        </aside>

        <section className="min-w-0 rounded-2xl border border-black/10 bg-[rgb(var(--surface))] p-4 shadow-sm dark:border-white/10" aria-label="Floor plan editor">
          {selectedPlan ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-balance text-[18px] font-bold text-[rgb(var(--text-primary))]">{selectedPlan.name}</h2>
                  <p className="text-[12px] text-[rgb(var(--text-muted))]">{selectedPlan.site.name} · {selectedPlan.floor} · revision {selectedPlan.revision}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-black/10 px-3 text-[12px] font-semibold hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.04]">
                    {isReplacing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />} Replace image
                    <input name="replacementPlanFile" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="sr-only" disabled={isReplacing || isDirty} onChange={(event) => void replaceImage(event.target.files?.[0] ?? null)} />
                  </label>
                  <button type="button" disabled={!isDirty || isSaving} onClick={() => void saveDraft()} className="flex min-h-11 items-center gap-2 rounded-xl border border-emerald-600 px-3 text-[12px] font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-300">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft
                  </button>
                  {selectedPlan.isPublished ? (
                    <button type="button" disabled={isSaving} onClick={() => void setPublished(false)} className="flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-3 text-[12px] font-semibold text-amber-950 disabled:opacity-50"><EyeOff className="h-4 w-4" /> Unpublish</button>
                  ) : (
                    <button type="button" disabled={!!publishIssue || isSaving} title={publishIssue ?? undefined} onClick={() => void setPublished(true)} className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Eye className="h-4 w-4" /> Publish</button>
                  )}
                </div>
              </div>

              <div className="mb-3 flex items-center gap-2 rounded-xl bg-blue-500/10 px-3 py-2 text-[12px] text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                <MousePointer2 className="h-4 w-4 shrink-0" /> Choose a room on the right, then click its position on the plan. Drag a marker to move it, or use the arrow keys for 1-pixel adjustments.
              </div>

              <div
                className="relative mx-auto w-full max-w-[1000px] overflow-hidden rounded-xl bg-white shadow-inner ring-1 ring-inset ring-black/15 dark:ring-white/15"
                style={{ aspectRatio: `${selectedPlan.imageWidth} / ${selectedPlan.imageHeight}` }}
                onClick={handlePlanClick}
              >
                {/* The image is authenticated and site-scoped by its route. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedPlan.imageUrl} alt={`${selectedPlan.name}, ${selectedPlan.floor}`} width={selectedPlan.imageWidth} height={selectedPlan.imageHeight} fetchPriority="high" draggable={false} className="absolute inset-0 h-full w-full select-none object-contain" />
                {workingRegions.map((region) => {
                  const selected = region.id === selectedRegionId
                  const orphaned = !region.roomId
                  return (
                    <button
                      key={region.id}
                      type="button"
                      onClick={(event) => { event.stopPropagation(); setSelectedRegionId(region.id); setRoomToPlace('') }}
                      onPointerDown={(event) => beginRegionDrag(event, region)}
                      onPointerMove={(event) => dragRegion(event, region)}
                      onPointerUp={endRegionDrag}
                      onPointerCancel={endRegionDrag}
                      onKeyDown={(event) => nudgeRegion(event, region)}
                      aria-label={`${region.label}${orphaned ? ', needs relinking' : ''}`}
                      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
                      aria-pressed={selected}
                      className={`absolute grid min-h-12 touch-none select-none place-items-center overflow-hidden rounded-lg border-2 px-1 text-center text-[clamp(10px,1.2vw,13px)] font-bold leading-tight shadow-md transition-colors focus-visible:z-20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/90 ${orphaned ? 'border-red-600 bg-red-500/75 text-white' : selected ? 'cursor-grab border-emerald-700 bg-emerald-400/85 text-emerald-950 active:cursor-grabbing' : 'cursor-grab border-indigo-700 bg-indigo-400/75 text-indigo-950 hover:bg-indigo-300/90 active:cursor-grabbing'}`}
                      style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }}
                    >
                      {region.label}
                    </button>
                  )
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[rgb(var(--text-muted))]">
                <span>{workingRegions.length} marked area{workingRegions.length === 1 ? '' : 's'} · Coordinates scale with every screen size</span>
                <span>{isDirty ? 'Unsaved changes' : selectedPlan.isPublished ? 'Live in cleaner portal' : 'Saved draft'}</span>
              </div>
            </>
          ) : (
            <div className="grid h-full min-h-[500px] place-items-center text-center">
              <div className="max-w-sm">
                <MapPinned className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
                <h2 className="text-balance text-[20px] font-bold text-[rgb(var(--text-primary))]">Upload a floor plan</h2>
                <p className="mt-2 text-[13px] text-[rgb(var(--text-muted))]">Once uploaded, you can mark each cleanable room or area and link it to its existing NeatPlan record.</p>
                <button type="button" onClick={() => setShowCreate(true)} className="mt-4 min-h-11 rounded-xl bg-emerald-600 px-4 text-[13px] font-semibold text-white"><Upload className="mr-2 inline h-4 w-4" /> Add the first plan</button>
              </div>
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-black/10 bg-[rgb(var(--surface))] p-4 shadow-sm dark:border-white/10" aria-label="Room placement controls">
          {selectedPlan ? (
            <div className="grid gap-5">
              <div>
                <label htmlFor="room-to-place" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[rgb(var(--text-muted))]">Room to place</label>
                <select id="room-to-place" name="roomToPlace" value={roomToPlace} onChange={(event) => { setRoomToPlace(event.target.value); setSelectedRegionId(null) }} className="min-h-12 w-full rounded-xl border border-[rgb(var(--control-border))] bg-[rgb(var(--surface-raised))] px-3 text-[14px] text-[rgb(var(--text-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
                  <option value="">Choose a room…</option>
                  {roomsAvailableToPlace.map((room) => <option key={room.id} value={room.id}>{room.name}{room.type === 'SERVICE_AREA' ? ' · Service area' : ''}{room.floor ? ` · ${room.floor}` : ''}</option>)}
                </select>
                {roomToPlace && (
                  <button
                    type="button"
                    onClick={() => {
                      const room = siteRooms.find((candidate) => candidate.id === roomToPlace)
                      if (room) addRoomRegion(room, 0.5, 0.5)
                    }}
                    className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-500 px-3 text-[12px] font-semibold text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:text-emerald-300"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" /> Place in Centre
                  </button>
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-[rgb(var(--text-muted))]">Only unmarked locations are shown. Service areas open their stored equipment; hallways and other rooms open their cleaning checklist.</p>
              </div>

              {selectedRegion ? (
                <div className="grid gap-4 border-t border-black/10 pt-5 dark:border-white/10">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[rgb(var(--text-muted))]">Selected area</div>
                    <div className="mt-1 text-[16px] font-bold text-[rgb(var(--text-primary))]">{selectedRegion.label}</div>
                  </div>
                  {!selectedRegion.roomId && (
                    <label className="grid gap-1.5 text-[12px] font-semibold text-red-700 dark:text-red-300">Relink required
                      <select name="replacementRoom" value="" onChange={(event) => relinkSelectedRegion(event.target.value)} className="min-h-12 rounded-xl border border-red-400 bg-[rgb(var(--surface-raised))] px-3 text-[14px] text-[rgb(var(--text-primary))]">
                        <option value="">Choose a replacement room…</option>
                        {roomsAvailableToPlace.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="grid gap-2 text-[12px] font-semibold">Marker width <span className="font-normal tabular-nums text-[rgb(var(--text-muted))]">{Math.round(selectedRegion.width * 100)}%</span>
                    <input name="markerWidth" type="range" min="0.06" max="0.35" step="0.01" value={selectedRegion.width} onChange={(event) => patchSelectedRegion({ width: Number(event.target.value) })} className="accent-emerald-600" />
                  </label>
                  <label className="grid gap-2 text-[12px] font-semibold">Marker height <span className="font-normal tabular-nums text-[rgb(var(--text-muted))]">{Math.round(selectedRegion.height * 100)}%</span>
                    <input name="markerHeight" type="range" min="0.06" max="0.3" step="0.01" value={selectedRegion.height} onChange={(event) => patchSelectedRegion({ height: Number(event.target.value) })} className="accent-emerald-600" />
                  </label>
                  <p className="rounded-xl bg-black/[0.03] p-3 text-[12px] leading-relaxed text-[rgb(var(--text-muted))] dark:bg-white/[0.04]">Keep the marker focused and press an arrow key to move it 1 pixel at a time.</p>
                  <button type="button" onClick={removeSelectedRegion} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-300 text-[12px] font-semibold text-red-700 hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" /> Remove marker</button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-black/15 p-4 text-center text-[12px] text-[rgb(var(--text-muted))] dark:border-white/15">Select a marker to drag, resize, nudge with the arrow keys or remove it.</div>
              )}

              <div className="border-t border-black/10 pt-5 text-[12px] dark:border-white/10">
                <div className="mb-2 flex items-center gap-2 font-semibold text-[rgb(var(--text-primary))]"><Check className="h-4 w-4 text-emerald-500" /> Publication checks</div>
                <ul className="grid gap-2 text-[rgb(var(--text-muted))]">
                  <li>{workingRegions.length > 0 ? '✓' : '○'} At least one marked room</li>
                  <li>{workingRegions.every((region) => region.roomId) ? '✓' : '○'} Every area linked</li>
                  <li>{!isDirty ? '✓' : '○'} Draft saved</li>
                </ul>
                {publishIssue && <p className="mt-3 rounded-lg bg-amber-500/10 p-2 text-amber-800 dark:text-amber-200">{publishIssue}</p>}
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-[rgb(var(--text-muted))]">Room placement controls appear after a plan is selected.</div>
          )}
        </aside>
      </div>
    </fieldset>
  )
}
