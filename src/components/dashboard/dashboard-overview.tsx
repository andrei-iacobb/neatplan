'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { useThemeColors } from '@/hooks/useThemeColors'
import {
  Users, Wrench, DoorOpen, Calendar, AlertTriangle, Activity,
  ArrowRight, Clock, CheckCircle2, AlertCircle, Loader2,
  BedDouble, Building2, UtensilsCrossed, Presentation,
  MoreHorizontal, Sparkles, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { apiRequest } from '@/lib/url-utils'

interface DashboardStats {
  totalUsers: number; totalRooms: number; totalEquipment: number; totalSchedules: number; recentActivity: any[]
}
interface ScheduleStatusCounts { pending: number; inProgress: number; completed: number; overdue: number }
interface RoomTypeCounts { [key: string]: number }

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }

export function DashboardOverview() {
  const { data: session } = useSession()
  const tc = useThemeColors()
  const [stats, setStats] = useState<DashboardStats>({ totalUsers: 0, totalRooms: 0, totalEquipment: 0, totalSchedules: 0, recentActivity: [] })
  const [scheduleCounts, setScheduleCounts] = useState<ScheduleStatusCounts>({ pending: 0, inProgress: 0, completed: 0, overdue: 0 })
  const [roomTypes, setRoomTypes] = useState<RoomTypeCounts>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weekly, setWeekly] = useState<number[]>([])
  const [weeklyDays, setWeeklyDays] = useState<string[]>([])

  useEffect(() => { fetchDashboardStats() }, [])

  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true)
      const [usersRes, roomsRes, equipmentRes, schedulesRes, activityRes, weeklyRes, roomSchedulesRes] = await Promise.all([
        apiRequest('/api/users').catch(() => ({ ok: false })),
        apiRequest('/api/rooms').catch(() => ({ ok: false })),
        apiRequest('/api/admin/equipment').catch(() => ({ ok: false })),
        apiRequest('/api/schedules').catch(() => ({ ok: false })),
        apiRequest('/api/admin/recent-activity').catch(() => ({ ok: false })),
        apiRequest('/api/admin/completion-stats').catch(() => ({ ok: false })),
        apiRequest('/api/room-schedules').catch(() => ({ ok: false })),
      ])
      const users = usersRes.ok && 'json' in usersRes ? await usersRes.json() : []
      const rooms = roomsRes.ok && 'json' in roomsRes ? await roomsRes.json() : []
      const equipment = equipmentRes.ok && 'json' in equipmentRes ? await equipmentRes.json() : { equipment: [] }
      const schedules = schedulesRes.ok && 'json' in schedulesRes ? await schedulesRes.json() : []
      const activity = activityRes.ok && 'json' in activityRes ? await activityRes.json() : { activities: [] }
      const weeklyJson = weeklyRes.ok && 'json' in weeklyRes ? await weeklyRes.json() : { counts: [], days: [] }
      const roomSchedules = roomSchedulesRes.ok && 'json' in roomSchedulesRes ? await roomSchedulesRes.json() : []

      const sc: ScheduleStatusCounts = { pending: 0, inProgress: 0, completed: 0, overdue: 0 }
      if (Array.isArray(roomSchedules)) roomSchedules.forEach((rs: any) => { if (rs.status === 'PENDING') sc.pending++; else if (rs.status === 'IN_PROGRESS') sc.inProgress++; else if (rs.status === 'COMPLETED') sc.completed++; else if (rs.status === 'OVERDUE') sc.overdue++ })
      setScheduleCounts(sc)

      const tp: RoomTypeCounts = {}
      if (Array.isArray(rooms)) rooms.forEach((r: any) => { const t = r.type || 'OTHER'; tp[t] = (tp[t] || 0) + 1 })
      setRoomTypes(tp)

      setStats({ totalUsers: Array.isArray(users) ? users.length : 0, totalRooms: Array.isArray(rooms) ? rooms.length : 0, totalEquipment: Array.isArray(equipment.equipment) ? equipment.equipment.length : 0, totalSchedules: Array.isArray(schedules) ? schedules.length : 0, recentActivity: activity.activities || [] })
      setWeekly(Array.isArray(weeklyJson.counts) ? weeklyJson.counts : [])
      setWeeklyDays(Array.isArray(weeklyJson.days) ? weeklyJson.days : [])
    } catch (e) { console.error(e); setError('Failed to load dashboard data') } finally { setIsLoading(false) }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        className="w-8 h-8 rounded-full border-2 border-transparent" style={{ borderTopColor: 'rgb(16,185,129)', borderRightColor: 'rgba(16,185,129,0.3)' }} />
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgb(239,68,68)' }} />
        <p className="text-sm mb-4" style={{ color: tc.textMuted }}>{error}</p>
        <button onClick={fetchDashboardStats} className="btn-primary px-5 py-2 text-sm rounded-lg">Retry</button>
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
    { name: 'Manage Rooms', href: '/rooms', icon: DoorOpen, desc: 'Add, edit, and organise cleaning locations', accent: '#10b981' },
    { name: 'Equipment', href: '/equipment', icon: Wrench, desc: 'Track maintenance equipment and schedules', accent: '#f59e0b' },
    { name: 'Schedules', href: '/schedule', icon: Calendar, desc: 'Create and manage cleaning schedules', accent: '#ec4899' },
    { name: 'Users', href: '/users', icon: Users, desc: 'Manage team members and permissions', accent: '#6366f1' },
  ]

  return (
    <div className="max-w-[1100px] mx-auto relative z-10 pb-8">
      {/* Greeting */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4" style={{ color: 'rgb(16,185,129)' }} />
          <p className="text-[13px] font-medium tracking-wide uppercase" style={{ color: tc.accentLabel }}>{dateStr}</p>
        </div>
        <h1 className="text-[32px] font-bold tracking-tight mb-1" style={{ color: tc.textPrimary }}>{greeting}, {userName}</h1>
        <p className="text-[15px]" style={{ color: tc.textMuted }}>
          {weeklyTotal > 0 ? `${weeklyTotal} tasks completed this week across your facility.` : `Here's an overview of your cleaning management system.`}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {statCards.map((s, i) => (
          <motion.div key={s.name} {...fadeUp} transition={{ duration: 0.35, delay: 0.05 + i * 0.06 }}>
            <Link href={s.href} className="group block rounded-xl p-5 transition-all duration-200 relative overflow-hidden"
              style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = tc.cardHoverBorder(s.accent); e.currentTarget.style.background = tc.cardHoverBg }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = tc.cardBorder; e.currentTarget.style.background = tc.cardBg }}>
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-8 translate-x-8" style={{ background: s.accent, opacity: tc.glowOpacity }} />
              <div className="flex items-center justify-between mb-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${s.accent}${tc.iconBgAlpha}` }}>
                  <s.icon className="w-[18px] h-[18px]" style={{ color: s.accent }} strokeWidth={1.8} />
                </div>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-60 -translate-x-1 group-hover:translate-x-0 transition-all duration-200" style={{ color: s.accent }} />
              </div>
              <p className="text-[28px] font-bold tabular-nums" style={{ color: tc.textPrimary }}>{s.value}</p>
              <p className="text-[12px] font-medium mt-0.5" style={{ color: tc.textMuted }}>{s.name}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Chart + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-6">
        <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.3 }} className="lg:col-span-3 rounded-xl p-5"
          style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: tc.textPrimary }}>Weekly Completions</h2>
              <p className="text-[12px] mt-0.5" style={{ color: tc.textFaint }}>{weeklyTotal} total this week</p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ background: tc.chipBg(weeklyTotal > 0) }}>
              <TrendingUp className="w-3.5 h-3.5" style={{ color: tc.chipColor(weeklyTotal > 0) }} />
              <span className="text-[11px] font-semibold" style={{ color: tc.chipColor(weeklyTotal > 0) }}>{weeklyTotal}</span>
            </div>
          </div>
          <div className="h-[160px] flex items-end gap-2">
            {weeklyValues.map((v, i) => {
              const isToday = i === weeklyValues.length - 1
              const pct = Math.max(6, Math.round((v / maxVal) * 100))
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[10px] font-medium tabular-nums" style={{ color: v > 0 ? tc.textMuted : 'transparent' }}>{v}</span>
                  <motion.div initial={{ height: 0 }} animate={{ height: `${pct}%` }} transition={{ duration: 0.5, delay: 0.35 + i * 0.04 }}
                    className="w-full rounded-md relative overflow-hidden" style={{ background: isToday ? tc.barToday : tc.barBg }}>
                    {isToday && <div className="absolute inset-0" style={{ background: `linear-gradient(to top, transparent, ${tc.barShine})` }} />}
                  </motion.div>
                  <span className="text-[10px] font-medium" style={{ color: isToday ? tc.textSecondary : tc.textFaint }}>{dayLabels[i]}</span>
                </div>
              )
            })}
          </div>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.36 }} className="lg:col-span-2 rounded-xl p-5"
          style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: tc.textPrimary }}>Schedule Status</h2>
              <p className="text-[12px] mt-0.5" style={{ color: tc.textFaint }}>{totalSch} room schedules</p>
            </div>
            {completionRate > 0 && <span className="text-[22px] font-bold" style={{ color: 'rgb(16,185,129)' }}>{completionRate}%</span>}
          </div>
          <div className="space-y-2.5">
            <StatusRow icon={<Clock className="w-3.5 h-3.5" />} label="Pending" count={scheduleCounts.pending} color="#f59e0b" tc={tc} />
            <StatusRow icon={<Loader2 className="w-3.5 h-3.5" />} label="In Progress" count={scheduleCounts.inProgress} color="#6366f1" tc={tc} />
            <StatusRow icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Completed" count={scheduleCounts.completed} color="#10b981" tc={tc} />
            <StatusRow icon={<AlertCircle className="w-3.5 h-3.5" />} label="Overdue" count={scheduleCounts.overdue} color="#ef4444" tc={tc} />
          </div>
          {totalSch > 0 && (
            <div className="mt-4 h-1.5 rounded-full overflow-hidden flex" style={{ background: tc.progressBg }}>
              {scheduleCounts.completed > 0 && <div className="h-full" style={{ width: `${(scheduleCounts.completed / totalSch) * 100}%`, background: '#10b981' }} />}
              {scheduleCounts.inProgress > 0 && <div className="h-full" style={{ width: `${(scheduleCounts.inProgress / totalSch) * 100}%`, background: '#6366f1' }} />}
              {scheduleCounts.pending > 0 && <div className="h-full" style={{ width: `${(scheduleCounts.pending / totalSch) * 100}%`, background: 'rgba(245,158,11,0.5)' }} />}
              {scheduleCounts.overdue > 0 && <div className="h-full" style={{ width: `${(scheduleCounts.overdue / totalSch) * 100}%`, background: '#ef4444' }} />}
            </div>
          )}
        </motion.div>
      </div>

      {/* Rooms + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mb-6">
        <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.42 }} className="lg:col-span-2 rounded-xl p-5"
          style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold" style={{ color: tc.textPrimary }}>Rooms by Type</h2>
            <Link href="/rooms" className="text-[11px] font-medium transition-colors" style={{ color: tc.textFaint }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(16,185,129)'}
              onMouseLeave={(e) => e.currentTarget.style.color = tc.textFaint}>View all &rarr;</Link>
          </div>
          <div className="space-y-2">
            {Object.entries(roomTypes).sort(([,a],[,b]) => b - a).slice(0,6).map(([type, count]) => {
              const pct = Math.round((count / (stats.totalRooms || 1)) * 100)
              return (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <RoomTypeIcon type={type} tc={tc} />
                      <span className="text-[12px] font-medium" style={{ color: tc.textSecondary }}>{formatRoomType(type)}</span>
                    </div>
                    <span className="text-[12px] font-semibold tabular-nums" style={{ color: tc.textMuted }}>{count}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: tc.progressBg }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: 0.5 }} className="h-full rounded-full" style={{ background: 'rgba(16,185,129,0.4)' }} />
                  </div>
                </div>
              )
            })}
            {Object.keys(roomTypes).length > 6 && (
              <div className="flex items-center gap-2 pt-1">
                <MoreHorizontal className="w-3.5 h-3.5" style={{ color: tc.textFaint }} />
                <span className="text-[11px]" style={{ color: tc.textFaint }}>+{Object.keys(roomTypes).length - 6} more</span>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.48 }} className="lg:col-span-3 rounded-xl p-5"
          style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}>
          <h2 className="text-[15px] font-semibold mb-4" style={{ color: tc.textPrimary }}>Recent Activity</h2>
          {stats.recentActivity.length > 0 ? (
            <div className="space-y-1">
              {stats.recentActivity.slice(0, 6).map((item, index) => (
                <ActivityItem key={item.id || index} activity={item} tc={tc} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: tc.emptyBg }}>
                <Activity className="w-5 h-5" style={{ color: tc.textFaint }} />
              </div>
              <p className="text-[13px] font-medium" style={{ color: tc.textMuted }}>No recent activity</p>
              <p className="text-[11px] mt-1" style={{ color: tc.textFaint }}>Activity will appear as tasks are completed</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.54 }}>
        <h2 className="text-[15px] font-semibold mb-3" style={{ color: tc.textPrimary }}>Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((a) => (
            <Link key={a.name} href={a.href}
              className="group block rounded-xl p-4 transition-all duration-200 relative overflow-hidden"
              style={{ background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = tc.cardHoverBorder(a.accent) }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = tc.cardBorder }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${a.accent}${tc.iconBgAlpha}` }}>
                <a.icon className="w-4 h-4" style={{ color: a.accent }} strokeWidth={1.8} />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold" style={{ color: tc.textPrimary }}>{a.name}</h3>
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 -translate-x-1 group-hover:translate-x-0 transition-all duration-200" style={{ color: a.accent }} />
              </div>
              <p className="text-[11px] mt-1 leading-relaxed" style={{ color: tc.textMuted }}>{a.desc}</p>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

function StatusRow({ icon, label, count, color, tc }: { icon: React.ReactNode; label: string; count: number; color: string; tc: ReturnType<typeof useThemeColors> }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${color}${tc.iconBgAlpha}`, color }}>{icon}</div>
        <span className="text-[12px] font-medium" style={{ color: tc.textSecondary }}>{label}</span>
      </div>
      <span className="text-[13px] font-bold tabular-nums" style={{ color: count > 0 ? color : tc.textFaint }}>{count}</span>
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
    <div className="flex items-center gap-3 py-2 rounded-lg px-2 transition-colors duration-100"
      onMouseEnter={(e) => e.currentTarget.style.background = tc.hoverRow}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
      <p className="text-[12px] font-medium flex-1 min-w-0 truncate" style={{ color: tc.textSecondary }}>{activity.description || activity.title || 'Unknown activity'}</p>
      <span className="text-[10px] font-medium flex-shrink-0 tabular-nums" style={{ color: tc.textFaint }}>{timeAgo}</span>
    </div>
  )
}

function RoomTypeIcon({ type, tc }: { type: string; tc: ReturnType<typeof useThemeColors> }) {
  const s = { color: tc.textMuted }; const c = "w-3.5 h-3.5"
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
