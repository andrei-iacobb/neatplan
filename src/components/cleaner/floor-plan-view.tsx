"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, Clock3, MapPinned, PackageOpen, TriangleAlert } from 'lucide-react'

export type CleanerFloorPlanRegion = {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  kind: 'ROOM' | 'SERVICE_AREA'
  priority: 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'COMPLETED' | 'NO_WORK'
  totalTasks: number
  itemCount: number
  room: { id: string; name: string; floor: string; type: string }
}

export type CleanerFloorPlan = {
  id: string
  name: string
  floor: string
  imageUrl: string
  imageWidth: number
  imageHeight: number
  regions: CleanerFloorPlanRegion[]
}

const statusMeta = {
  OVERDUE: {
    label: 'Overdue',
    marker: 'border-red-800 bg-red-500/90 text-white',
    dot: 'bg-red-500',
    icon: TriangleAlert,
  },
  DUE_TODAY: {
    label: 'Due today',
    marker: 'border-amber-800 bg-amber-400/95 text-amber-950',
    dot: 'bg-amber-400',
    icon: Clock3,
  },
  UPCOMING: {
    label: 'Upcoming',
    marker: 'border-blue-800 bg-blue-400/90 text-blue-950',
    dot: 'bg-blue-400',
    icon: Clock3,
  },
  COMPLETED: {
    label: 'Completed',
    marker: 'border-emerald-800 bg-emerald-500/90 text-white',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  NO_WORK: {
    label: 'No work due',
    marker: 'border-slate-700 bg-slate-300/90 text-slate-900',
    dot: 'bg-slate-400',
    icon: Circle,
  },
} as const

export function CleanerFloorPlanView({ plans }: { plans: CleanerFloorPlan[] }) {
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? '')

  useEffect(() => {
    if (!plans.some((plan) => plan.id === selectedPlanId)) setSelectedPlanId(plans[0]?.id ?? '')
  }, [plans, selectedPlanId])

  const plan = plans.find((candidate) => candidate.id === selectedPlanId) ?? plans[0]
  if (!plan) return null

  return (
    <section className="mb-8 rounded-2xl border border-black/10 bg-[rgb(var(--surface))] p-4 shadow-sm dark:border-white/10 sm:p-5" aria-labelledby="cleaner-floor-plan-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-400"><MapPinned className="h-4 w-4" /> Visual work list</div>
          <h2 id="cleaner-floor-plan-title" className="text-balance text-[22px] font-bold tracking-[-0.02em] text-[rgb(var(--text-primary))]">Choose a room or service area</h2>
          <p className="mt-1 text-[13px] text-[rgb(var(--text-muted))]">The colour shows its current cleaning status. Service areas open the equipment stored inside.</p>
        </div>
        {plans.length > 1 && (
          <div className="flex flex-wrap gap-2" aria-label="Choose floor">
            {plans.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => setSelectedPlanId(candidate.id)}
                aria-pressed={candidate.id === plan.id}
                className={`min-h-12 rounded-xl border px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 active:scale-[0.97] ${candidate.id === plan.id ? 'border-emerald-500 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200' : 'border-black/10 text-[rgb(var(--text-secondary))] hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.04]'}`}
              >
                {candidate.floor}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2" aria-label="Floor plan status key">
        {Object.entries(statusMeta).map(([status, meta]) => (
          <span key={status} className="flex items-center gap-1.5 text-[12px] font-medium text-[rgb(var(--text-secondary))]"><span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} aria-hidden="true" />{meta.label}</span>
        ))}
        <span className="flex items-center gap-1.5 border-l border-black/10 pl-4 text-[12px] font-medium text-[rgb(var(--text-secondary))] dark:border-white/10"><PackageOpen className="h-3.5 w-3.5" aria-hidden="true" />Service area</span>
      </div>

      <div className="relative mx-auto w-full max-w-[1100px] overflow-hidden rounded-xl border border-black/15 bg-white shadow-inner dark:border-white/15" style={{ aspectRatio: `${plan.imageWidth} / ${plan.imageHeight}` }}>
        {/* The image endpoint authenticates the user and verifies site ownership. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={plan.imageUrl} alt={`${plan.name}, ${plan.floor}`} width={plan.imageWidth} height={plan.imageHeight} fetchPriority="high" draggable={false} className="absolute inset-0 h-full w-full select-none object-contain" />
        {plan.regions.map((region) => {
          const meta = statusMeta[region.priority]
          const StatusIcon = region.kind === 'SERVICE_AREA' ? PackageOpen : meta.icon
          const href = region.kind === 'SERVICE_AREA'
            ? `/clean/service-area/${region.room.id}`
            : `/clean/${region.room.id}`
          const itemSummary = region.kind === 'SERVICE_AREA'
            ? `, ${region.itemCount} item${region.itemCount === 1 ? '' : 's'} stored`
            : ''
          return (
            <Link
              key={region.id}
              href={href}
              aria-label={`${region.room.name}${region.kind === 'SERVICE_AREA' ? ' service area' : ''}: ${meta.label}${itemSummary}${region.totalTasks ? `, ${region.totalTasks} tasks` : ''}`}
              className={`group absolute grid min-h-12 place-items-center overflow-hidden rounded-lg border-2 px-1 text-center text-[clamp(10px,1.2vw,14px)] font-bold leading-tight shadow-md transition-[filter,transform] duration-150 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/95 active:scale-[0.97] ${meta.marker}`}
              style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }}
            >
              <span className="flex max-w-full items-center justify-center gap-1 overflow-hidden">
                <StatusIcon className="hidden h-3.5 w-3.5 shrink-0 sm:block" aria-hidden="true" />
                <span className="truncate">{region.label}</span>
              </span>
            </Link>
          )
        })}
      </div>
      {plan.regions.length === 0 && <p className="mt-3 rounded-xl bg-amber-500/10 p-3 text-[13px] text-amber-800 dark:text-amber-200">This floor plan has no rooms or service areas available. Ask the Head of Housekeeping to review it.</p>}
    </section>
  )
}
