'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { fadeUp, enter } from '@/lib/motion'
import { useSession } from 'next-auth/react'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useSiteFilter, ALL_SITES } from '@/hooks/useSiteFilter'
import { SiteFilter } from '@/components/dashboard/site-filter'
import {
  Users, Wrench, DoorOpen, Calendar, AlertTriangle, Activity,
  ArrowRight, Clock, CheckCircle2, AlertCircle, Loader2,
  BedDouble, Building2, UtensilsCrossed, Presentation,
  MoreHorizontal, Sparkles, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { PageLoading, Spinner } from '@/components/ui/loading'
import { apiRequest } from '@/lib/url-utils'

interface DashboardStats {
  totalUsers: number; totalRooms: number; totalEquipment: number; totalSchedules: number; recentActivity: any[]
}
interface ScheduleStatusCounts { pending: number; inProgress: number; completed: number; overdue: number }
interface RoomTypeCounts { [key: string]: number }

const cardStyle = (tc: ReturnType<typeof useThemeColors>) => ({
  background: tc.cardBg,
  border: `1px solid ${tc.cardBorder}`,
  boxShadow: tc.shadow,
})

export function DashboardOverview() {
  const { data: session } = useSession()
  const tc = useThemeColors()
  const [stats, setStats] = useState<DashboardStats>({ totalUsers: 0, totalRooms: 0, totalEquipment: 0, totalSchedules: 0, recentActivity: [] })
  const [scheduleCounts, setScheduleCounts] = useState<ScheduleStatusCounts>({ pending: 0, inProgress: 0, completed: 0, overdue: 0 })
  const [roomTypes, setRoomTypes] = useState<RoomTypeCounts>({})
  const [isLoading, setIsLoading] = useState(true)
  // Distinguishes the first paint from a site switch. Without it, every switch
  // set isLoading and replaced the whole dashboard - site control included - with
  // a skeleton, which reads as a full page reload rather than a filter change.
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [weekly, setWeekly] = useState<number[]>([])
  const [weeklyDays, setWeeklyDays] = useState<string[]>([])

  const site = useSiteFilter()
  const latestRequest = useRef(0)

  // The site is a dependency, not a trigger: browser navigation changes the URL
  // and the refetch follows from that, with no extra wiring on the control.
  useEffect(() => {
    if (!site.ready) return
    fetchDashboardStats(site.selected)
  }, [site.ready, site.selected])

  const fetchDashboardStats = async (selected: string = site.selected) => {
    // One rule for all seven: the server decides. Filtering rooms and users in
    // the browser while the weekly chart needs a round trip would leave two
    // mechanisms that drift apart.
    const q = selected && selected !== ALL_SITES ? `?site=${encodeURIComponent(selected)}` : ''
    // Switching site twice quickly leaves two flights in the air, and the slower
    // one must not win. Only the newest request is allowed to write state.
    const seq = ++latestRequest.current
    const stale = () => seq !== latestRequest.current
    try {
      setIsLoading(true)
      const [usersRes, roomsRes, equipmentRes, schedulesRes, activityRes, weeklyRes, roomSchedulesRes] = await Promise.all([
        apiRequest(`/api/users${q}`).catch(() => ({ ok: false })),
        apiRequest(`/api/rooms${q}`).catch(() => ({ ok: false })),
        apiRequest(`/api/admin/equipment${q}`).catch(() => ({ ok: false })),
        apiRequest(`/api/schedules${q}`).catch(() => ({ ok: false })),
        apiRequest(`/api/admin/recent-activity${q}`).catch(() => ({ ok: false })),
        apiRequest(`/api/admin/completion-stats${q}`).catch(() => ({ ok: false })),
        apiRequest(`/api/room-schedules${q}`).catch(() => ({ ok: false })),
      ])
      const users = usersRes.ok && 'json' in usersRes ? await usersRes.json() : []
      const rooms = roomsRes.ok && 'json' in roomsRes ? await roomsRes.json() : []
      const equipment = equipmentRes.ok && 'json' in equipmentRes ? await equipmentRes.json() : { equipment: [] }
      const schedules = schedulesRes.ok && 'json' in schedulesRes ? await schedulesRes.json() : []
      const activity = activityRes.ok && 'json' in activityRes ? await activityRes.json() : { activities: [] }
      const weeklyJson = weeklyRes.ok && 'json' in weeklyRes ? await weeklyRes.json() : { counts: [], days: [] }
      const roomSchedules = roomSchedulesRes.ok && 'json' in roomSchedulesRes ? await roomSchedulesRes.json() : []

      if (stale()) return

      const sc: ScheduleStatusCounts = { pending: 0, inProgress: 0, completed: 0, overdue: 0 }
      if (Array.isArray(roomSchedules)) roomSchedules.forEach((rs: any) => { if (rs.status === 'PENDING') sc.pending++; else if (rs.status === 'IN_PROGRESS') sc.inProgress++; else if (rs.status === 'COMPLETED') sc.completed++; else if (rs.status === 'OVERDUE') sc.overdue++ })
      setScheduleCounts(sc)

      const tp: RoomTypeCounts = {}
      if (Array.isArray(rooms)) rooms.forEach((r: any) => { const t = r.type || 'OTHER'; tp[t] = (tp[t] || 0) + 1 })
      setRoomTypes(tp)

      setStats({ totalUsers: Array.isArray(users) ? users.filter((u: any) => u.role !== 'OP').length : 0, totalRooms: Array.isArray(rooms) ? rooms.length : 0, totalEquipment: Array.isArray(equipment.equipment) ? equipment.equipment.length : 0, totalSchedules: Array.isArray(schedules) ? schedules.length : 0, recentActivity: activity.activities || [] })
      setWeekly(Array.isArray(weeklyJson.counts) ? weeklyJson.counts : [])
      setWeeklyDays(Array.isArray(weeklyJson.days) ? weeklyJson.days : [])
    } catch (e) { if (stale()) return; console.error(e); setError('Failed to load dashboard data') } finally { if (!stale()) { setIsLoading(false); setHasLoaded(true) } }
  }

  // Only the very first load gets the skeleton. Afterwards the numbers on screen
  // stay put and are replaced in place when the new site's data lands.
  const isSwitching = isLoading && hasLoaded

  if (isLoading && !hasLoaded) return (
    <div className="max-w-[1230px] mx-auto relative z-10 pb-[17px]">
      <PageLoading cards={4} label="Loading dashboard" />
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgb(239,68,68)' }} />
        <p className="text-sm mb-4" style={{ color: tc.textMuted }}>{error}</p>
        <button onClick={() => fetchDashboardStats()} className="btn-primary px-5 py-2 text-sm rounded-lg">Retry</button>
      </div>
    </div>
  )

  const greeting = getGreeting()
  const userName = session?.user?.name?.split(' ')[0] || 'Admin'
  const dateStr = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const totalSch = scheduleCounts.pending + scheduleCounts.inProgress + scheduleCounts.completed + scheduleCounts.overdue
  const completionRate = totalSch > 0 ? Math.round((scheduleCounts.completed / totalSch) * 100) : 0
  const weeklyValues = weekly.length ? weekly : [0,0,0,0,0,0,0]
  const maxVal = Math.max(1, ...weeklyValues)
  const weeklyTotal = weeklyValues.reduce((a, b) => a + b, 0)
  const dayLabels = weeklyDays.length === 7 ? weeklyDays.map(d => new Date(d).toLocaleDateString('en-GB', { weekday: 'short' })) : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

  const statCards = [
    { name: 'Team Members', value: stats.totalUsers, icon: Users, accent: '#6366f1', href: '/users' },
    { name: 'Total Rooms', value: stats.totalRooms, icon: DoorOpen, accent: '#10b981', href: '/rooms' },
    { name: 'Equipment', value: stats.totalEquipment, icon: Wrench, accent: '#f59e0b', href: '/equipment' },
    { name: 'Active Schedules', value: stats.totalSchedules, icon: Calendar, accent: '#ec4899', href: '/schedule' },
  ]

  const quickActions = [
    { name: 'Manage Rooms', href: '/rooms', icon: DoorOpen, accent: '#10b981' },
    { name: 'Equipment', href: '/equipment', icon: Wrench, accent: '#f59e0b' },
    { name: 'Schedules', href: '/schedule', icon: Calendar, accent: '#ec4899' },
    { name: 'Users', href: '/users', icon: Users, accent: '#6366f1' },
  ]

  return (
    <div className="max-w-[1230px] mx-auto relative z-10 flex flex-col gap-[17px] lg:gap-[13px] pb-[17px]">
      {/* Compact header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Sparkles className="w-[15px] h-[15px] flex-shrink-0" style={{ color: 'rgb(16,185,129)' }} />
            <p className="text-[14px] font-medium" style={{ color: tc.accentLabel }}>{dateStr}</p>
          </div>
          <h1 className="text-[23px] sm:text-[25px] font-semibold tracking-tight leading-tight" style={{ color: tc.textPrimary }}>
            {greeting}, {userName}
          </h1>
        </div>
        {/* The right slot used to hold a sentence that said nothing. While a site
            switch is in flight it names what is happening, so the fade below reads
            as loading rather than as the page glitching. */}
        {isSwitching ? (
          <p className="text-[14px] leading-snug sm:text-right flex items-center gap-2 sm:justify-end" style={{ color: tc.textMuted }}>
            <Spinner className="w-[14px] h-[14px]" />
            Updating{site.selectedSite ? ` for ${site.selectedSite.name}` : ''}
          </p>
        ) : weeklyTotal > 0 && (
          <p className="text-[14px] leading-snug sm:text-right" style={{ color: tc.textMuted }}>
            {weeklyTotal} tasks completed this week
          </p>
        )}
      </header>

      {/* The site control gets its own full-width row rather than the header's
          ~500px right slot. That slot is what forced a dropdown at six homes; across
          the full 1230px column the homes fit as pills and stay visible, which is
          the point of a filter you switch between. */}
      <SiteFilter
        sites={site.sites}
        selected={site.selected}
        onSelect={site.setSelected}
        canPick={site.canPick}
        recents={site.recents}
      />

      {/*
        Everything below the site control is the site's data. It stays mounted
        across a switch and just fades while the new figures are in flight, so the
        page keeps its shape instead of collapsing to a skeleton and back.
        The wrapper repeats the parent's column gap so inserting it changes no layout.
      */}
      <div
        className="flex flex-col gap-[17px] lg:gap-[13px] transition-opacity duration-200 ease-out"
        style={{ opacity: isSwitching ? 0.4 : 1, pointerEvents: isSwitching ? 'none' : undefined }}
        aria-busy={isSwitching}
      >

      {/* KPI row — horizontal, compact */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-[11px]">
        {statCards.map((s, i) => (
          <motion.div key={s.name} {...fadeUp} transition={enter(i)} className="h-full">
            <Link href={s.href} className="group flex h-full w-full items-center gap-3 rounded-xl px-[15px] py-[13px] transition-all duration-200"
              style={cardStyle(tc)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = tc.cardHoverBorder(s.accent); e.currentTarget.style.background = tc.cardHoverBg }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = tc.cardBorder; e.currentTarget.style.background = tc.cardBg }}>
              <div className="w-[37px] h-[37px] rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: `${s.accent}${tc.iconBgAlpha}` }}>
                <s.icon className="w-[19px] h-[19px]" style={{ color: s.accent }} strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[23px] sm:text-[25px] font-bold tabular-nums leading-none" style={{ color: tc.textPrimary }}>{s.value}</p>
                <p className="text-[13px] sm:text-[14px] font-medium mt-0.5 leading-tight" style={{ color: tc.textMuted }}>{s.name}</p>
              </div>
              <ArrowRight className="w-[17px] h-[17px] flex-shrink-0 opacity-0 group-hover:opacity-50 transition-opacity hidden sm:block" style={{ color: s.accent }} />
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Main bento grid — fits one viewport on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-[11px] lg:gap-[13px] auto-rows-auto">
        {/* Weekly chart */}
        <motion.div {...fadeUp} transition={enter(4)}
          className="lg:col-span-7 rounded-xl p-[17px] flex flex-col"
          style={cardStyle(tc)}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[17px] font-semibold" style={{ color: tc.textPrimary }}>Weekly Completions</h2>
              <p className="text-[14px] mt-0.5" style={{ color: tc.textFaint }}>{weeklyTotal} total this week</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: tc.chipBg(weeklyTotal > 0) }}>
              <TrendingUp className="w-[17px] h-[17px]" style={{ color: tc.chipColor(weeklyTotal > 0) }} />
              <span className="text-[14px] font-semibold tabular-nums" style={{ color: tc.chipColor(weeklyTotal > 0) }}>{weeklyTotal}</span>
            </div>
          </div>
          <div className="h-[124px] sm:h-[134px] flex items-end gap-1.5 sm:gap-2 flex-1">
            {weeklyValues.map((v, i) => {
              const isToday = i === weeklyValues.length - 1
              const pct = Math.max(8, Math.round((v / maxVal) * 100))
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[13px] font-semibold tabular-nums leading-none" style={{ color: v > 0 ? tc.textSecondary : 'transparent' }}>{v}</span>
                  <motion.div initial={{ height: 0 }} animate={{ height: `${pct}%` }} transition={{ duration: 0.45, delay: 0.25 + i * 0.03 }}
                    className="w-full rounded-md relative overflow-hidden min-h-[6px]" style={{ background: isToday ? tc.barToday : tc.barBg }}>
                    {isToday && <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(to top, transparent, ${tc.barShine})` }} />}
                  </motion.div>
                  <span className="text-[13px] font-medium" style={{ color: isToday ? tc.textSecondary : tc.textFaint }}>{dayLabels[i]}</span>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Schedule status */}
        <motion.div {...fadeUp} transition={enter(5)}
          className="lg:col-span-5 rounded-xl p-[17px]"
          style={cardStyle(tc)}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[17px] font-semibold" style={{ color: tc.textPrimary }}>Schedule Status</h2>
              <p className="text-[14px] mt-0.5" style={{ color: tc.textFaint }}>{totalSch} room schedules</p>
            </div>
            {completionRate > 0 && <span className="text-[21px] font-bold tabular-nums" style={{ color: 'rgb(16,185,129)' }}>{completionRate}%</span>}
          </div>
          <div className="space-y-1.5">
            <StatusRow icon={<Clock className="w-[17px] h-[17px]" />} label="Pending" count={scheduleCounts.pending} color="#f59e0b" tc={tc} />
            <StatusRow icon={<Loader2 className="w-[17px] h-[17px]" />} label="In Progress" count={scheduleCounts.inProgress} color="#6366f1" tc={tc} />
            <StatusRow icon={<CheckCircle2 className="w-[17px] h-[17px]" />} label="Completed" count={scheduleCounts.completed} color="#10b981" tc={tc} />
            <StatusRow icon={<AlertCircle className="w-[17px] h-[17px]" />} label="Overdue" count={scheduleCounts.overdue} color="#ef4444" tc={tc} />
          </div>
          {totalSch > 0 && (
            <div className="mt-3 h-2 rounded-full overflow-hidden flex" style={{ background: tc.progressBg }}>
              {scheduleCounts.completed > 0 && <div className="h-full" style={{ width: `${(scheduleCounts.completed / totalSch) * 100}%`, background: '#10b981' }} />}
              {scheduleCounts.inProgress > 0 && <div className="h-full" style={{ width: `${(scheduleCounts.inProgress / totalSch) * 100}%`, background: '#6366f1' }} />}
              {scheduleCounts.pending > 0 && <div className="h-full" style={{ width: `${(scheduleCounts.pending / totalSch) * 100}%`, background: 'rgba(245,158,11,0.5)' }} />}
              {scheduleCounts.overdue > 0 && <div className="h-full" style={{ width: `${(scheduleCounts.overdue / totalSch) * 100}%`, background: '#ef4444' }} />}
            </div>
          )}
        </motion.div>

        {/* Rooms by type */}
        <motion.div {...fadeUp} transition={enter(6)}
          className="lg:col-span-4 rounded-xl p-[17px]"
          style={cardStyle(tc)}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[17px] font-semibold" style={{ color: tc.textPrimary }}>Rooms by Type</h2>
            <Link href="/rooms" className="text-[14px] font-medium transition-colors" style={{ color: tc.textFaint }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(16,185,129)'}
              onMouseLeave={(e) => e.currentTarget.style.color = tc.textFaint}>View all &rarr;</Link>
          </div>
          <div className="space-y-2">
            {Object.entries(roomTypes).sort(([,a],[,b]) => b - a).slice(0,5).map(([type, count]) => {
              const pct = Math.round((count / (stats.totalRooms || 1)) * 100)
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <RoomTypeIcon type={type} tc={tc} />
                      <span className="text-[14px] font-medium truncate" style={{ color: tc.textSecondary }}>{formatRoomType(type)}</span>
                    </div>
                    <span className="text-[15px] font-semibold tabular-nums ml-2 flex-shrink-0" style={{ color: tc.textMuted }}>{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: tc.progressBg }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, delay: 0.35 }} className="h-full rounded-full" style={{ background: 'rgba(16,185,129,0.45)' }} />
                  </div>
                </div>
              )
            })}
            {/* Zero is a valid answer for a real but empty site, so this names
                the site rather than reading like something went wrong. */}
            {Object.keys(roomTypes).length === 0 && (
              <div className="py-4 text-center">
                <p className="text-[14px]" style={{ color: tc.textFaint }}>
                  {site.selectedSite ? `No rooms in ${site.selectedSite.name} yet` : 'No rooms yet'}
                </p>
                <Link href="/rooms" className="text-[14px] font-medium inline-block mt-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50" style={{ color: 'rgb(16,185,129)' }}>
                  Add rooms &rarr;
                </Link>
              </div>
            )}
            {Object.keys(roomTypes).length > 5 && (
              <div className="flex items-center gap-2 pt-0.5">
                <MoreHorizontal className="w-[17px] h-[17px]" style={{ color: tc.textFaint }} />
                <span className="text-[14px]" style={{ color: tc.textFaint }}>+{Object.keys(roomTypes).length - 5} more</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent activity */}
        <motion.div {...fadeUp} transition={enter(7)}
          className="lg:col-span-5 rounded-xl p-[17px] flex flex-col min-h-0"
          style={cardStyle(tc)}>
          <h2 className="text-[17px] font-semibold mb-2" style={{ color: tc.textPrimary }}>Recent Activity</h2>
          {stats.recentActivity.length > 0 ? (
            <div className="space-y-0.5 flex-1 min-h-0">
              {stats.recentActivity.slice(0, 5).map((item, index) => (
                <ActivityItem key={item.id || index} activity={item} tc={tc} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 flex-1">
              <div className="w-[41px] h-[41px] rounded-full flex items-center justify-center mb-2" style={{ background: tc.emptyBg }}>
                <Activity className="w-[21px] h-[21px]" style={{ color: tc.textFaint }} />
              </div>
              <p className="text-[15px] font-medium" style={{ color: tc.textMuted }}>No recent activity</p>
              <p className="text-[14px] mt-0.5" style={{ color: tc.textFaint }}>Activity appears as tasks are completed</p>
            </div>
          )}
        </motion.div>

        {/* Quick actions — compact vertical list */}
        <motion.div {...fadeUp} transition={enter(8)}
          className="lg:col-span-3 rounded-xl p-[17px]"
          style={cardStyle(tc)}>
          <h2 className="text-[17px] font-semibold mb-2" style={{ color: tc.textPrimary }}>Quick Actions</h2>
          <nav className="space-y-1">
            {quickActions.map((a) => (
              <Link key={a.name} href={a.href}
                className="group flex items-center gap-3 rounded-lg px-[11px] py-[11px] transition-all duration-150"
                onMouseEnter={(e) => { e.currentTarget.style.background = tc.hoverRow; e.currentTarget.style.borderColor = tc.cardHoverBorder(a.accent) }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <div className="w-[33px] h-[33px] rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: `${a.accent}${tc.iconBgAlpha}` }}>
                  <a.icon className="w-[17px] h-[17px]" style={{ color: a.accent }} strokeWidth={1.8} />
                </div>
                <span className="text-[15px] font-medium flex-1 min-w-0" style={{ color: tc.textPrimary }}>{a.name}</span>
                <ArrowRight className="w-[17px] h-[17px] flex-shrink-0 opacity-30 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all" style={{ color: a.accent }} />
              </Link>
            ))}
          </nav>
        </motion.div>
      </div>

      </div>
    </div>
  )
}

function StatusRow({ icon, label, count, color, tc }: { icon: React.ReactNode; label: string; count: number; color: string; tc: ReturnType<typeof useThemeColors> }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2.5">
        <div className="w-[29px] h-[29px] rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${color}${tc.iconBgAlpha}`, color }}>{icon}</div>
        <span className="text-[15px] font-medium" style={{ color: tc.textSecondary }}>{label}</span>
      </div>
      <span className="text-[16px] font-bold tabular-nums" style={{ color: count > 0 ? color : tc.textFaint }}>{count}</span>
    </div>
  )
}

function ActivityItem({ activity, tc }: { activity: any; tc: ReturnType<typeof useThemeColors> }) {
  const timeAgo = activity.timestamp ? getTimeAgo(new Date(activity.timestamp)) : 'Just now'
  let dotColor = tc.textFaint
  if (activity.type === 'room_completion') dotColor = '#10b981'
  else if (activity.type === 'equipment_completion') dotColor = '#f59e0b'
  else if (activity.type === 'user_activity') dotColor = '#6366f1'
  return (
    <div className="flex items-center gap-2.5 py-2 rounded-lg px-2 transition-colors duration-100"
      onMouseEnter={(e) => e.currentTarget.style.background = tc.hoverRow}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <div className="w-[9px] h-[9px] rounded-full flex-shrink-0" style={{ background: dotColor }} />
      <p className="text-[15px] font-medium flex-1 min-w-0 truncate" style={{ color: tc.textSecondary }}>{activity.description || activity.title || 'Unknown activity'}</p>
      <span className="text-[13px] font-medium flex-shrink-0 tabular-nums" style={{ color: tc.textFaint }}>{timeAgo}</span>
    </div>
  )
}

function RoomTypeIcon({ type, tc }: { type: string; tc: ReturnType<typeof useThemeColors> }) {
  const s = { color: tc.textMuted }; const c = "w-[17px] h-[17px] flex-shrink-0"
  switch (type) {
    case 'BEDROOM': return <BedDouble className={c} style={s} />
    case 'OFFICE': return <Building2 className={c} style={s} />
    case 'KITCHEN': return <UtensilsCrossed className={c} style={s} />
    case 'MEETING_ROOM': return <Presentation className={c} style={s} />
    default: return <DoorOpen className={c} style={s} />
  }
}

function formatRoomType(t: string) { return t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) }
function getGreeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }
function getTimeAgo(d: Date) { const s = Math.floor((Date.now() - d.getTime()) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return `${Math.floor(s/60)}m ago`; if (s < 86400) return `${Math.floor(s/3600)}h ago`; if (s < 604800) return `${Math.floor(s/86400)}d ago`; return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }
