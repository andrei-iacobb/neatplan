'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { useThemeColors } from '@/hooks/useThemeColors'
import { apiRequest } from '@/lib/url-utils'
import {
  Sparkles,
  Download,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  Users,
  Search,
} from 'lucide-react'

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }

interface CompletionItem {
  id: string
  type: 'room' | 'equipment'
  completedAt: string
  itemName: string
  itemId: string
  floor: string | null
  itemType: string
  scheduleName: string
  frequency: string
  completedBy: { name: string | null; email: string } | null
  completedTasks: any
  totalTasks: number
  notes: string | null
}

interface Room {
  id: string
  name: string
}

interface UserItem {
  id: string
  name: string | null
  email: string
}

export default function AuditPage() {
  const { data: session } = useSession()
  const tc = useThemeColors()

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedRoom, setSelectedRoom] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Data
  const [items, setItems] = useState<CompletionItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  // Summary data
  const [complianceRate, setComplianceRate] = useState<number | null>(null)
  const [overdueCount, setOverdueCount] = useState<number | null>(null)
  const [topCleaner, setTopCleaner] = useState<string | null>(null)

  // Dropdowns
  const [rooms, setRooms] = useState<Room[]>([])
  const [users, setUsers] = useState<UserItem[]>([])

  // Expanded rows
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Fetch filter options
  useEffect(() => {
    apiRequest('/api/rooms').then(async (res) => {
      if (res.ok) {
        const data = await res.json()
        setRooms(Array.isArray(data) ? data : data.rooms || [])
      }
    }).catch(() => {})

    apiRequest('/api/users').then(async (res) => {
      if (res.ok) {
        const data = await res.json()
        setUsers(Array.isArray(data) ? data : data.users || [])
      }
    }).catch(() => {})
  }, [])

  // Fetch completion history
  const fetchHistory = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '25')
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (selectedRoom) params.set('roomId', selectedRoom)
      if (selectedUser) params.set('userId', selectedUser)

      const res = await apiRequest(`/api/admin/completion-history?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        let filtered = data.items || []
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          filtered = filtered.filter(
            (item: CompletionItem) =>
              item.itemName.toLowerCase().includes(q) ||
              item.scheduleName.toLowerCase().includes(q) ||
              (item.completedBy?.name || '').toLowerCase().includes(q) ||
              (item.completedBy?.email || '').toLowerCase().includes(q)
          )
        }
        setItems(filtered)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [page, dateFrom, dateTo, selectedRoom, selectedUser, searchQuery])

  // Fetch summary stats
  const fetchSummary = useCallback(async () => {
    try {
      const [rateRes, overdueRes] = await Promise.all([
        apiRequest('/api/admin/compliance-rate?period=week'),
        apiRequest('/api/admin/overdue-summary'),
      ])

      if (rateRes.ok) {
        const data = await rateRes.json()
        setComplianceRate(data.overallRate)
      }
      if (overdueRes.ok) {
        const data = await overdueRes.json()
        setOverdueCount(data.total)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  // Derive top cleaner from current items
  useEffect(() => {
    if (items.length === 0) {
      setTopCleaner(null)
      return
    }
    const counts: Record<string, { name: string; count: number }> = {}
    for (const item of items) {
      if (item.completedBy?.email) {
        const key = item.completedBy.email
        if (!counts[key]) counts[key] = { name: item.completedBy.name || item.completedBy.email, count: 0 }
        counts[key].count++
      }
    }
    const sorted = Object.values(counts).sort((a, b) => b.count - a.count)
    setTopCleaner(sorted[0]?.name || null)
  }, [items])

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [dateFrom, dateTo, selectedRoom, selectedUser, searchQuery])

  const handleExport = () => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    if (selectedRoom) params.set('roomId', selectedRoom)
    if (selectedUser) params.set('userId', selectedUser)
    window.open(`/api/admin/export-report?${params.toString()}`, '_blank')
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const getTasksDone = (completedTasks: any): number => {
    if (Array.isArray(completedTasks)) return completedTasks.length
    return 0
  }

  if (!session?.user?.isAdmin) {
    return (
      <div className="max-w-[1100px] mx-auto relative z-10 pb-8">
        <div className="flex items-center justify-center p-12">
          <p className="text-[15px]" style={{ color: tc.textMuted }}>
            Admin access required to view the audit log.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1100px] mx-auto relative z-10 pb-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-10">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4" style={{ color: 'rgb(16,185,129)' }} />
            <p
              className="text-[13px] font-medium tracking-wide uppercase"
              style={{ color: tc.accentLabel }}
            >
              Compliance Tracking
            </p>
          </div>
          <h1
            className="text-[32px] font-bold tracking-tight mb-1"
            style={{ color: tc.textPrimary }}
          >
            Compliance Audit Log
          </h1>
          <p className="text-[15px]" style={{ color: tc.textMuted }}>
            Track and verify that cleaning schedules are completed on time
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 whitespace-nowrap flex-shrink-0"
          style={{
            background: tc.btnPrimaryBg,
            color: tc.btnPrimaryText,
            border: `1px solid ${tc.btnPrimaryBorder}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = tc.btnPrimaryHoverBg
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = tc.btnPrimaryBg
          }}
          onClick={handleExport}
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filter Bar */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.35, delay: 0.03 }}
        className="rounded-xl p-4 mb-6"
        style={{
          background: tc.cardBg,
          border: `1px solid ${tc.cardBorder}`,
          boxShadow: tc.shadow,
        }}
      >
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: tc.textMuted }}>
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-[13px] outline-none"
              style={{
                background: tc.inputBg,
                border: `1px solid ${tc.inputBorder}`,
                color: tc.inputText,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
              onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: tc.textMuted }}>
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-[13px] outline-none"
              style={{
                background: tc.inputBg,
                border: `1px solid ${tc.inputBorder}`,
                color: tc.inputText,
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
              onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: tc.textMuted }}>
              Room
            </label>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-[13px] outline-none min-w-[140px]"
              style={{
                background: tc.inputBg,
                border: `1px solid ${tc.inputBorder}`,
                color: tc.inputText,
              }}
            >
              <option value="">All Rooms</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: tc.textMuted }}>
              Cleaner
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-[13px] outline-none min-w-[140px]"
              style={{
                background: tc.inputBg,
                border: `1px solid ${tc.inputBorder}`,
                color: tc.inputText,
              }}
            >
              <option value="">All Cleaners</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-[11px] font-medium uppercase tracking-wider" style={{ color: tc.textMuted }}>
              Search
            </label>
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                style={{ color: tc.textMuted }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, schedule..."
                className="rounded-lg pl-8 pr-3 py-1.5 text-[13px] outline-none w-full"
                style={{
                  background: tc.inputBg,
                  border: `1px solid ${tc.inputBorder}`,
                  color: tc.inputText,
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = tc.inputFocusBorder }}
                onBlur={(e) => { e.currentTarget.style.borderColor = tc.inputBorder }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.35, delay: 0.06 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
      >
        {[
          {
            label: 'Total Completions',
            value: total,
            icon: ClipboardCheck,
            color: tc.accentGreen,
          },
          {
            label: 'Compliance Rate',
            value: complianceRate !== null ? `${complianceRate}%` : '--',
            icon: TrendingUp,
            color: tc.accentIndigo,
          },
          {
            label: 'Overdue Items',
            value: overdueCount !== null ? overdueCount : '--',
            icon: AlertTriangle,
            color: overdueCount && overdueCount > 0 ? tc.accentRed : tc.accentAmber,
          },
          {
            label: 'Top Cleaner',
            value: topCleaner || '--',
            icon: Users,
            color: tc.accentBlue,
          },
        ].map((card, i) => (
          <div
            key={i}
            className="rounded-xl p-4"
            style={{
              background: tc.cardBg,
              border: `1px solid ${tc.cardBorder}`,
              boxShadow: tc.shadow,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${card.color}${tc.iconBgAlpha}` }}
              >
                <card.icon className="w-3.5 h-3.5" style={{ color: card.color }} />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: tc.textMuted }}>
                {card.label}
              </span>
            </div>
            <p
              className="text-[22px] font-bold tracking-tight truncate"
              style={{ color: tc.textPrimary }}
            >
              {card.value}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Table */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.35, delay: 0.09 }}
        className="rounded-xl overflow-hidden"
        style={{
          background: tc.cardBg,
          border: `1px solid ${tc.cardBorder}`,
          boxShadow: tc.shadow,
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 rounded-full border-2 border-transparent"
              style={{
                borderTopColor: 'rgb(16,185,129)',
                borderRightColor: 'rgba(16,185,129,0.3)',
              }}
            />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[13px]" style={{ color: tc.textMuted }}>
              No completion records found. Adjust filters or wait for schedule completions.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: tc.tableHeaderBg }}>
                  {['Date / Time', 'Room / Equipment', 'Schedule', 'Completed By', 'Tasks', 'Notes', ''].map(
                    (h, i) => (
                      <th
                        key={i}
                        className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3"
                        style={{ color: tc.textMuted, borderBottom: `1px solid ${tc.tableDivider}` }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const tasksDone = getTasksDone(item.completedTasks)
                  const isExpanded = expandedId === item.id
                  return (
                    <AnimatePresence key={item.id}>
                      <tr
                        className="cursor-pointer transition-colors duration-100"
                        style={{ borderBottom: `1px solid ${tc.tableDivider}` }}
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = tc.hoverRow
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <td className="px-4 py-3">
                          <p className="text-[13px] font-medium" style={{ color: tc.textPrimary }}>
                            {formatDate(item.completedAt)}
                          </p>
                          <p className="text-[11px]" style={{ color: tc.textMuted }}>
                            {formatTime(item.completedAt)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[13px] font-medium" style={{ color: tc.textPrimary }}>
                            {item.itemName}
                          </p>
                          <p className="text-[11px]" style={{ color: tc.textMuted }}>
                            {item.type === 'room' && item.floor ? `Floor ${item.floor} - ` : ''}
                            {item.itemType}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[13px]" style={{ color: tc.textPrimary }}>
                            {item.scheduleName}
                          </p>
                          <p className="text-[11px]" style={{ color: tc.textMuted }}>
                            {item.frequency}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-[13px]" style={{ color: tc.textPrimary }}>
                            {item.completedBy?.name || item.completedBy?.email || '--'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium"
                            style={{
                              background:
                                tasksDone === item.totalTasks && item.totalTasks > 0
                                  ? tc.statusCompleted.bg
                                  : tc.statusPending.bg,
                              color:
                                tasksDone === item.totalTasks && item.totalTasks > 0
                                  ? tc.statusCompleted.text
                                  : tc.statusPending.text,
                              border: `1px solid ${
                                tasksDone === item.totalTasks && item.totalTasks > 0
                                  ? tc.statusCompleted.border
                                  : tc.statusPending.border
                              }`,
                            }}
                          >
                            {tasksDone}/{item.totalTasks}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[180px]">
                          <p
                            className="text-[12px] truncate"
                            style={{ color: tc.textSecondary }}
                            title={item.notes || ''}
                          >
                            {item.notes || '--'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" style={{ color: tc.textMuted }} />
                          ) : (
                            <ChevronDown className="w-4 h-4" style={{ color: tc.textMuted }} />
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${item.id}-expanded`}>
                          <td
                            colSpan={7}
                            className="px-4 py-3"
                            style={{
                              background: tc.surfaceBg,
                              borderBottom: `1px solid ${tc.tableDivider}`,
                            }}
                          >
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <p
                                className="text-[12px] font-semibold mb-2 uppercase tracking-wider"
                                style={{ color: tc.textMuted }}
                              >
                                Completed Tasks
                              </p>
                              {Array.isArray(item.completedTasks) && item.completedTasks.length > 0 ? (
                                <ul className="space-y-1">
                                  {item.completedTasks.map((task: any, idx: number) => (
                                    <li
                                      key={idx}
                                      className="flex items-center gap-2 text-[13px]"
                                      style={{ color: tc.textSecondary }}
                                    >
                                      <div
                                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                        style={{ background: tc.accentGreen }}
                                      />
                                      {typeof task === 'string' ? task : task.description || task.title || JSON.stringify(task)}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-[13px]" style={{ color: tc.textMuted }}>
                                  No task details recorded.
                                </p>
                              )}
                              {item.notes && (
                                <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${tc.tableDivider}` }}>
                                  <p
                                    className="text-[12px] font-semibold mb-1 uppercase tracking-wider"
                                    style={{ color: tc.textMuted }}
                                  >
                                    Notes
                                  </p>
                                  <p className="text-[13px]" style={{ color: tc.textSecondary }}>
                                    {item.notes}
                                  </p>
                                </div>
                              )}
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: `1px solid ${tc.tableDivider}` }}
          >
            <p className="text-[12px]" style={{ color: tc.textMuted }}>
              Showing {(page - 1) * 25 + 1}-{Math.min(page * 25, total)} of {total} records
            </p>
            <div className="flex items-center gap-1">
              <button
                className="p-1.5 rounded-lg transition-colors duration-150"
                style={{
                  background: tc.btnSecondaryBg,
                  color: page === 1 ? tc.textFaint : tc.btnSecondaryText,
                  border: `1px solid ${tc.btnSecondaryBorder}`,
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                }}
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    className="w-8 h-8 rounded-lg text-[12px] font-medium transition-colors duration-150"
                    style={{
                      background: page === pageNum ? tc.tabActiveBg : tc.btnSecondaryBg,
                      color: page === pageNum ? tc.tabActiveText : tc.btnSecondaryText,
                      border: `1px solid ${page === pageNum ? tc.tabActiveBorder : tc.btnSecondaryBorder}`,
                    }}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                className="p-1.5 rounded-lg transition-colors duration-150"
                style={{
                  background: tc.btnSecondaryBg,
                  color: page === totalPages ? tc.textFaint : tc.btnSecondaryText,
                  border: `1px solid ${tc.btnSecondaryBorder}`,
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                }}
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
