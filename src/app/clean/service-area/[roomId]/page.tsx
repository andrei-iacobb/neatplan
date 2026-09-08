'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  MapPin,
  PackageOpen,
  RefreshCw,
  TriangleAlert,
  Wrench,
} from 'lucide-react'
import { PageLoading } from '@/components/ui/loading'
import { apiRequest } from '@/lib/url-utils'
import { canUseCleaningPortal } from '@/lib/roles'
import type { CleanerWorkPriority } from '@/lib/cleaner-work-priority'

type ServiceAreaEquipment = {
  id: string
  name: string
  description: string | null
  type: string
  assetCode: string | null
  priority: CleanerWorkPriority
  scheduleCount: number
  totalTasks: number
}

type ServiceArea = {
  id: string
  name: string
  description: string | null
  floor: string | null
  priority: CleanerWorkPriority
  ownCleaning: {
    priority: CleanerWorkPriority
    scheduleCount: number
    totalTasks: number
  } | null
  summary: {
    itemCount: number
    itemsWithCleaningWork: number
    totalTasks: number
  }
  equipment: ServiceAreaEquipment[]
}

const statusMeta = {
  OVERDUE: { label: 'Overdue', classes: 'border-red-300 bg-red-50 text-red-950 dark:border-red-700 dark:bg-red-950 dark:text-red-100', icon: TriangleAlert },
  DUE_TODAY: { label: 'Due today', classes: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100', icon: Clock3 },
  UPCOMING: { label: 'Upcoming', classes: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100', icon: Clock3 },
  COMPLETED: { label: 'Completed', classes: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100', icon: CheckCircle2 },
  NO_WORK: { label: 'No work due', classes: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100', icon: Circle },
} as const

export default function CleanerServiceAreaPage() {
  const params = useParams<{ roomId: string }>()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [serviceArea, setServiceArea] = useState<ServiceArea | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadServiceArea = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await apiRequest(`/api/cleaner/service-areas/${params.roomId}`)
      if (!response.ok) throw new Error('load')
      setServiceArea(await response.json() as ServiceArea)
    } catch {
      setError('This service area could not be loaded. Check the connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }, [params.roomId])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth')
      return
    }
    if (status === 'authenticated' && !canUseCleaningPortal(session?.user?.role)) {
      router.replace('/')
      return
    }
    if (status === 'authenticated') void loadServiceArea()
  }, [status, session?.user?.role, router, loadServiceArea])

  if (status === 'loading' || isLoading) {
    return <div className="mx-auto max-w-5xl px-4 py-8"><PageLoading cards={4} label="Loading service area" /></div>
  }

  if (error || !serviceArea) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-4 text-center">
        <div className="rounded-2xl border border-red-300 bg-red-50 p-6 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
          <TriangleAlert className="mx-auto mb-3 h-8 w-8" aria-hidden="true" />
          <h1 className="text-balance text-xl font-bold">Service area unavailable</h1>
          <p className="mt-2 text-sm">{error ?? 'This service area is unavailable.'}</p>
          <button type="button" onClick={() => void loadServiceArea()} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl border border-current px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
          </button>
        </div>
      </div>
    )
  }

  const areaStatus = statusMeta[serviceArea.priority]
  const AreaStatusIcon = areaStatus.icon

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <Link href="/clean" className="mb-5 inline-flex min-h-12 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-[rgb(var(--text-secondary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to floor plan
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-400">
            <PackageOpen className="h-4 w-4" aria-hidden="true" /> Service area
          </div>
          <h1 className="text-balance text-3xl font-bold tracking-[-0.03em] text-[rgb(var(--text-primary))]">{serviceArea.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[rgb(var(--text-muted))]">
            {serviceArea.floor && <><MapPin className="h-4 w-4" aria-hidden="true" /><span>{serviceArea.floor}</span></>}
            {serviceArea.description && <span>· {serviceArea.description}</span>}
          </div>
        </div>
        <span className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold ${areaStatus.classes}`}>
          <AreaStatusIcon className="h-4 w-4" aria-hidden="true" /> {areaStatus.label}
        </span>
      </header>

      <section aria-label="Service area summary" className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          ['Items stored', serviceArea.summary.itemCount],
          ['Items with schedules', serviceArea.summary.itemsWithCleaningWork],
          ['Tasks in this area', serviceArea.summary.totalTasks],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-black/10 bg-[rgb(var(--surface))] p-4 shadow-sm dark:border-white/10">
            <p className="text-xs font-bold uppercase tracking-[0.07em] text-[rgb(var(--text-muted))]">{label}</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-[rgb(var(--text-primary))]">{value}</p>
          </div>
        ))}
      </section>

      {serviceArea.ownCleaning && (
        <section className="mb-6" aria-labelledby="area-cleaning-heading">
          <h2 id="area-cleaning-heading" className="mb-3 text-xl font-bold text-[rgb(var(--text-primary))]">Cupboard or area cleaning</h2>
          <Link href={`/clean/${serviceArea.id}`} className="flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
            <span>
              <span className="block font-bold">Clean {serviceArea.name}</span>
              <span className="mt-1 block text-sm">{serviceArea.ownCleaning.scheduleCount} schedule{serviceArea.ownCleaning.scheduleCount === 1 ? '' : 's'} · {serviceArea.ownCleaning.totalTasks} tasks</span>
            </span>
            <span className="text-sm font-semibold">Open checklist</span>
          </Link>
        </section>
      )}

      <section aria-labelledby="stored-equipment-heading">
        <div className="mb-3">
          <h2 id="stored-equipment-heading" className="text-xl font-bold text-[rgb(var(--text-primary))]">Equipment stored here</h2>
          <p className="mt-1 text-sm text-[rgb(var(--text-muted))]">Open an item when its cleaning work is due.</p>
        </div>

        {serviceArea.equipment.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/15 p-8 text-center dark:border-white/15">
            <PackageOpen className="mx-auto mb-3 h-9 w-9 text-[rgb(var(--text-muted))]" aria-hidden="true" />
            <h3 className="font-bold text-[rgb(var(--text-primary))]">Nothing assigned here yet</h3>
            <p className="mt-1 text-sm text-[rgb(var(--text-muted))]">A Head of Housekeeping can assign equipment to this service area from Equipment Management.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {serviceArea.equipment.map((item) => {
              const meta = statusMeta[item.priority]
              const StatusIcon = meta.icon
              const content = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><Wrench className="h-5 w-5" aria-hidden="true" /></span>
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-[rgb(var(--text-primary))]">{item.name}</span>
                        <span className="mt-1 block text-xs text-[rgb(var(--text-muted))]">{item.type.replaceAll('_', ' ')}{item.assetCode ? ` · ${item.assetCode}` : ''}</span>
                      </span>
                    </span>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${meta.classes}`}><StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />{meta.label}</span>
                  </div>
                  <p className="mt-4 text-sm text-[rgb(var(--text-secondary))]">{item.scheduleCount > 0 ? `${item.scheduleCount} schedule${item.scheduleCount === 1 ? '' : 's'} · ${item.totalTasks} tasks` : 'Stored here · no cleaning schedule'}</p>
                </>
              )
              return item.scheduleCount > 0 ? (
                <Link key={item.id} href={`/clean/equipment/${item.id}`} className="min-h-28 rounded-2xl border border-black/10 bg-[rgb(var(--surface))] p-4 shadow-sm transition-colors hover:border-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-white/10">{content}</Link>
              ) : (
                <article key={item.id} className="min-h-28 rounded-2xl border border-black/10 bg-[rgb(var(--surface))] p-4 shadow-sm dark:border-white/10">{content}</article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
