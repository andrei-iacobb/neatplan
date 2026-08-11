'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { fadeUp, enter } from '@/lib/motion'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useSiteFilter, ALL_SITES } from '@/hooks/useSiteFilter'
import { SiteFilter } from '@/components/dashboard/site-filter'
import { apiRequest } from '@/lib/url-utils'
import { PageLoading, Spinner } from '@/components/ui/loading'
import {
  ChevronLeft, ChevronRight, ChevronDown, DoorOpen, Wrench, AlertTriangle,
  Sparkles, Calendar
} from 'lucide-react'
import { getFrequencyLabel } from '@/lib/schedule-utils'
import Link from 'next/link'

interface DiaryItem {
  id: string
  kind: 'room' | 'equipment'
  targetName: string
  floor?: string | null
  siteName: string
  scheduleTitle: string
  frequency: string
  nextDue: string
  status: string
}
interface GroupedByDay {
  [dateKey: string]: DiaryItem[]
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Local-time key: toISOString would shift local midnights across the UTC
// boundary during BST and bucket items under the wrong day column.
function getDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getDayOfWeek(date: Date): string {
  return DAYS_OF_WEEK[date.getDay() === 0 ? 6 : date.getDay() - 1]
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
}

export default function DiaryPage() {
  const { data: session } = useSession()
  const tc = useThemeColors()
  const site = useSiteFilter()

  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()))
  const [overdueOpen, setOverdueOpen] = useState(false)
  const [items, setItems] = useState<DiaryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!site.ready) return
    fetchDiaryItems()
  }, [site.ready, site.selected, currentWeekStart])

  const fetchDiaryItems = async () => {
    if (!site.ready) return

    const weekEnd = new Date(currentWeekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    try {
      setIsLoading(true)
      const q = site.selected && site.selected !== ALL_SITES ? `?site=${encodeURIComponent(site.selected)}` : ''
      const startISO = currentWeekStart.toISOString()
      const endISO = weekEnd.toISOString()
      const url = `/api/admin/diary?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}${q ? '&' + q.slice(1) : ''}`

      const res = await apiRequest(url).catch(() => ({ ok: false }))
      if (!res.ok || !('json' in res)) {
        setItems([])
        setError('Failed to load diary data')
        return
      }

      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
      setError(null)
    } catch (e) {
      console.error('Error fetching diary data:', e)
      setError('Failed to load diary data')
      setItems([])
    } finally {
      setIsLoading(false)
      setHasLoaded(true)
    }
  }

  // Separate overdue items from week items
  const overdueItems = items.filter(i => i.status === 'OVERDUE')
  const weekItems = items.filter(i => i.status !== 'OVERDUE')

  // Group week items by day
  const groupedByDay: GroupedByDay = {}
  weekItems.forEach(item => {
    const key = getDateKey(new Date(item.nextDue))
    if (!groupedByDay[key]) groupedByDay[key] = []
    groupedByDay[key].push(item)
  })

  // Generate array of 7 days starting from weekStart
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  const isSwitching = isLoading && hasLoaded

  if (isLoading && !hasLoaded) {
    return (
      <div className="max-w-[1230px] mx-auto relative z-10 pb-[17px]">
        <PageLoading cards={1} label="Loading diary" />
      </div>
    )
  }

  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className="max-w-[1230px] mx-auto relative z-10 flex flex-col gap-[17px] lg:gap-[13px] pb-[17px]">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Calendar className="w-[15px] h-[15px] shrink-0" style={{ color: 'rgb(16,185,129)' }} />
            <p className="text-[14px] font-medium" style={{ color: tc.accentLabel }}>{dateStr}</p>
          </div>
          <h1 className="text-[23px] sm:text-[25px] font-semibold tracking-tight leading-tight" style={{ color: tc.textPrimary }}>
            Cleaning Diary
          </h1>
        </div>
        {isSwitching && (
          <p className="text-[14px] leading-snug sm:text-right flex items-center gap-2 sm:justify-end" style={{ color: tc.textMuted }}>
            <Spinner className="w-[14px] h-[14px]" />
            Updating{site.selectedSite ? ` for ${site.selectedSite.name}` : ''}
          </p>
        )}
      </header>

      <SiteFilter
        sites={site.sites}
        selected={site.selected}
        onSelect={site.setSelected}
        canPick={site.canPick}
        recents={site.recents}
      />

      {/* Content */}
      <div
        className="flex flex-col gap-[17px] lg:gap-[13px] transition-opacity duration-200 ease-out"
        style={{ opacity: isSwitching ? 0.4 : 1, pointerEvents: isSwitching ? 'none' : undefined }}
        aria-busy={isSwitching}
      >
        {/* Week navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentWeekStart(prev => {
              const d = new Date(prev)
              d.setDate(d.getDate() - 7)
              return d
            })}
            className="p-2 rounded-lg transition-all duration-150 flex items-center gap-1"
            style={{
              color: tc.textSecondary,
              background: `rgba(16, 185, 129, 0.08)`
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `rgba(16, 185, 129, 0.12)`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `rgba(16, 185, 129, 0.08)`
            }}
            title="Previous week"
          >
            <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={2} />
            <span className="text-[13px] font-medium hidden sm:inline">Previous</span>
          </button>

          <div className="text-center">
            <p className="text-[13px]" style={{ color: tc.textMuted }}>
              Week of {formatDateShort(currentWeekStart)} - {formatDateShort(new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000))}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentWeekStart(getWeekStart(new Date()))}
              className="px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150"
              style={{
                color: 'rgb(16, 185, 129)',
                border: '1px solid rgb(16, 185, 129)',
                background: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
              title="Jump to this week"
            >
              This Week
            </button>

            <button
              onClick={() => setCurrentWeekStart(prev => {
                const d = new Date(prev)
                d.setDate(d.getDate() + 7)
                return d
              })}
              className="p-2 rounded-lg transition-all duration-150 flex items-center gap-1"
              style={{
                color: tc.textSecondary,
                background: `rgba(16, 185, 129, 0.08)`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `rgba(16, 185, 129, 0.12)`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `rgba(16, 185, 129, 0.08)`
              }}
              title="Next week"
            >
              <span className="text-[13px] font-medium hidden sm:inline">Next</span>
              <ChevronRight className="w-[18px] h-[18px]" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Overdue section */}
        {overdueItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl overflow-hidden"
            style={{
              background: tc.cardBg,
              border: `1px solid rgb(239, 68, 68)`,
              boxShadow: tc.shadow
            }}
          >
            <button
              onClick={() => setOverdueOpen(o => !o)}
              className="w-full px-[17px] py-[13px] flex items-center justify-between"
              style={overdueOpen ? { borderBottom: '1px solid rgba(239, 68, 68, 0.2)' } : undefined}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-[18px] h-[18px]" style={{ color: 'rgb(239, 68, 68)' }} />
                <h2 className="text-[15px] font-semibold" style={{ color: 'rgb(239, 68, 68)' }}>
                  Overdue as of today ({overdueItems.length})
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: tc.textMuted }}>
                  {overdueOpen ? 'Hide' : 'Show'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${overdueOpen ? 'rotate-180' : ''}`}
                  style={{ color: tc.textMuted }}
                />
              </div>
            </button>

            {overdueOpen && (
              <div className="p-[17px] space-y-2 max-h-[420px] overflow-y-auto">
                {overdueItems.map((item) => (
                  <DiaryItemRow key={item.id} item={item} tc={tc} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Week grid */}
        {error ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgb(239,68,68)' }} />
              <p className="text-sm mb-4" style={{ color: tc.textMuted }}>{error}</p>
              <button
                onClick={() => fetchDiaryItems()}
                className="btn-primary px-5 py-2 text-sm rounded-lg"
              >
                Retry
              </button>
            </div>
          </div>
        ) : weekItems.length === 0 && overdueItems.length === 0 ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="text-center">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" style={{ color: tc.textMuted }} />
              <p className="text-sm" style={{ color: tc.textMuted }}>No scheduled cleaning tasks this week</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-[13px]">
            {weekDays.map((date, idx) => {
              const dateKey = getDateKey(date)
              const dayItems = groupedByDay[dateKey] || []
              const isToday = getDateKey(new Date()) === dateKey

              return (
                <motion.div
                  key={dateKey}
                  {...fadeUp}
                  transition={enter(idx)}
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: tc.cardBg,
                    border: `1px solid ${isToday ? 'rgb(16, 185, 129)' : tc.cardBorder}`,
                    boxShadow: tc.shadow
                  }}
                >
                  <div className="px-[13px] py-[11px]" style={{ background: isToday ? 'rgba(16, 185, 129, 0.08)' : 'transparent', borderBottom: `1px solid ${tc.cardBorder}` }}>
                    <p className="text-[13px] font-semibold" style={{ color: isToday ? 'rgb(16, 185, 129)' : tc.textPrimary }}>
                      {getDayOfWeek(date)}
                    </p>
                    <p className="text-[12px]" style={{ color: isToday ? 'rgb(16, 185, 129)' : tc.textMuted }}>
                      {formatDateShort(date)}
                    </p>
                  </div>

                  {dayItems.length === 0 ? (
                    <div className="px-[13px] py-[24px] flex items-center justify-center text-center min-h-[80px]">
                      <p className="text-[12px]" style={{ color: tc.textFaint }}>No tasks</p>
                    </div>
                  ) : (
                    <div className="px-[13px] py-[13px] space-y-2">
                      {dayItems.map((item) => (
                        <DiaryItemCompact key={item.id} item={item} tc={tc} />
                      ))}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

interface DiaryItemRowProps {
  item: DiaryItem
  tc: ReturnType<typeof useThemeColors>
}

function DiaryItemRow({ item, tc }: DiaryItemRowProps) {
  const Icon = item.kind === 'room' ? DoorOpen : Wrench

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: 'rgba(0, 0, 0, 0.02)' }}>
      <div
        className="shrink-0 w-8 h-8 rounded-sm flex items-center justify-center"
        style={{
          background: item.kind === 'room' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)'
        }}
      >
        <Icon
          className="w-4 h-4"
          style={{ color: item.kind === 'room' ? 'rgb(16, 185, 129)' : 'rgb(245, 158, 11)' }}
          strokeWidth={2}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[13px] font-semibold truncate" style={{ color: tc.textPrimary }}>
            {item.targetName}
          </p>
          {item.floor && (
            <span className="text-[11px] px-2 py-0.5 rounded-sm" style={{ background: 'rgba(0, 0, 0, 0.04)', color: tc.textMuted }}>
              {item.floor}
            </span>
          )}
        </div>
        <p className="text-[12px] truncate" style={{ color: tc.textMuted }}>
          {item.scheduleTitle}
        </p>
        <div className="flex items-center gap-2 mt-1.5 text-[11px]">
          <span
            className="px-1.5 py-0.5 rounded-sm font-medium"
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              color: 'rgb(16, 185, 129)'
            }}
          >
            {getFrequencyLabel(item.frequency as any)}
          </span>
          <span style={{ color: tc.textFaint }}>
            {item.siteName}
          </span>
        </div>
      </div>
    </div>
  )
}

interface DiaryItemCompactProps {
  item: DiaryItem
  tc: ReturnType<typeof useThemeColors>
}

function DiaryItemCompact({ item, tc }: DiaryItemCompactProps) {
  const Icon = item.kind === 'room' ? DoorOpen : Wrench

  return (
    <div
      className="p-2 rounded-sm border transition-all duration-150"
      style={{
        background: 'rgba(0, 0, 0, 0.02)',
        borderColor: 'rgba(0, 0, 0, 0.05)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)'
        e.currentTarget.style.background = 'rgba(16, 185, 129, 0.04)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.05)'
        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)'
      }}
    >
      <div className="flex items-start gap-1.5">
        <Icon
          className="w-3.5 h-3.5 shrink-0 mt-0.5"
          style={{ color: item.kind === 'room' ? 'rgb(16, 185, 129)' : 'rgb(245, 158, 11)' }}
          strokeWidth={2.2}
        />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold leading-tight truncate" style={{ color: tc.textPrimary }}>
            {item.targetName}
          </p>
          <p className="text-[10px] leading-tight truncate" style={{ color: tc.textMuted }}>
            {item.scheduleTitle.length > 20 ? item.scheduleTitle.slice(0, 20) + '...' : item.scheduleTitle}
          </p>
        </div>
      </div>
    </div>
  )
}
