"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { LogoWithText } from "@/components/ui/logo"
import {
  ShieldCheck,
  Lock,
  Eye,
  Users,
  Calendar,
  Wrench,
  DoorOpen,
  Cpu,
  Server,
  Cloud,
  Rocket,
  CheckCircle2,
  BadgeCheck,
  Bot,
  Upload,
  Mail,
  Activity,
  History,
  ArrowLeftRight,
  Gauge,
  KeyRound,
  Clock,
} from "lucide-react"

type DemoRole = "ADMIN" | "CLEANER"

export default function DemoPage() {
  const [role, setRole] = useState<DemoRole>("ADMIN")
  const [scenario, setScenario] = useState<'normal' | 'overdue' | 'equipment'>('normal')
  const [showDemoView, setShowDemoView] = useState(false)

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 text-gray-100">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/20 blur-[120px] rounded-full" />
          <div className="absolute -bottom-24 -right-24 w-[28rem] h-[28rem] bg-teal-500/20 blur-[140px] rounded-full" />
        </div>

        <div className="max-w-7xl mx-auto px-4 pt-16 pb-8">
          <div className="flex items-center gap-3 mb-6">
            <LogoWithText textSize="xl" />
            <span className="px-2 py-1 rounded-lg text-xs bg-blue-500/10 text-blue-300 border border-blue-500/30">Demo</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Welcome to NeatPlan
          </h1>
          <p className="mt-4 text-gray-300 max-w-2xl">
            A modern cleaning operations platform for admins and cleaners. Explore how each role works using the toggle below.
          </p>

          <div className="mt-6">
            <button onClick={() => setShowDemoView(true)} className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600/70 to-teal-500/70 text-white border border-blue-500/40 hover:from-blue-600 hover:to-teal-500 transition-colors text-sm" aria-label="Open demo view">
              See Demo
            </button>
          </div>
        </div>
      </section>

      {/* Preview */}
      <section className="max-w-7xl mx-auto px-4 py-6">
        <motion.div
          key={role}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-5"
        >
          <div className="lg:col-span-2">
            <Highlights />
          </div>
        </motion.div>
      </section>

      {/* Inline Demo Modal */}
      {showDemoView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDemoView(false)} />
          <div className="relative max-w-5xl w-[92%] md:w-[80%] lg:w-[70%] max-h-[85vh] overflow-auto rounded-2xl border border-gray-700/60 bg-gray-900/90 backdrop-blur-md shadow-2xl p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Demo View</h3>
              <button onClick={() => setShowDemoView(false)} className="px-3 py-1.5 rounded-lg bg-gray-800/70 border border-gray-700 text-gray-300 hover:bg-gray-800">Close</button>
            </div>
            {/* In-modal controls: View as + Scenarios */}
            <div className="mb-4">
              <SegmentedRoleToggle role={role} onChange={setRole} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {([
                  { key: 'normal', label: 'Normal day' },
                  { key: 'overdue', label: 'Many overdue' },
                  { key: 'equipment', label: 'Equipment-heavy' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setScenario(opt.key)}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${scenario === opt.key ? 'bg-teal-500/20 border-teal-400/40 text-teal-200' : 'bg-gray-900/40 border-gray-700/50 text-gray-300 hover:border-teal-400/30'}`}
                  >
                    {opt.label}
                  </button>
                ))}
                <span className="ml-2 text-xs text-gray-500">role: {role}</span>
              </div>
            </div>
            {role === 'ADMIN' ? <MockAdminDashboard scenario={scenario} /> : <MockCleanerDashboard scenario={scenario} />}
          </div>
        </div>
      )}

      

      {/* Features & Stack */}
      <section className="max-w-7xl mx-auto px-4 pb-16 pt-4 grid md:grid-cols-2 gap-6">
        <FeaturePanel
          title="Security"
          subtitle="Built-in protections and hardening"
          items={[
            { icon: ShieldCheck, title: "IP Whitelisting", desc: "Restrict access to approved networks only." },
            { icon: Lock, title: "Role-based Access", desc: "Admin and Cleaner roles keep data scoped." },
            { icon: Eye, title: "Session Tracking", desc: "Active sessions and presence monitoring." },
          ]}
        />

        <FeaturePanel
          title="Core Features"
          subtitle="Everything you need to stay on top"
          items={[
            { icon: Calendar, title: "Smart Scheduling", desc: "Room and equipment schedules with frequencies." },
            { icon: DoorOpen, title: "Room Tasks", desc: "Granular cleaning tasks, due dates, and status." },
            { icon: Wrench, title: "Equipment", desc: "Maintenance schedules for critical equipment." },
          ]}
        />

        <FeaturePanel
          title="Technology"
          subtitle="Modern, fast, and reliable"
          items={[
            { icon: Cpu, title: "Next.js", desc: "App Router, serverless-ready, TypeScript." },
            { icon: Server, title: "PostgreSQL + Prisma", desc: "Typed models, migrations, reliability." },
            { icon: Cloud, title: "Docker-ready", desc: "Run locally or in the cloud with ease." },
          ]}
        />

        <FeaturePanel
          title="Why NeatPlan?"
          subtitle="Designed for real-world operations"
          items={[
            { icon: Users, title: "Delightful UX", desc: "Clear, focused experiences for each role." },
            { icon: BadgeCheck, title: "Operational Confidence", desc: "Live activity, statuses, and auditability." },
            { icon: Rocket, title: "Scales with you", desc: "From small teams to large facilities." },
          ]}
        />
      </section>
    </main>
  )
}

function SegmentedRoleToggle({ role, onChange }: { role: DemoRole; onChange: (r: DemoRole) => void }) {
  return (
    <div className="flex items-center mt-8">
      {/* View as label */}
      <span className="px-4 py-2 text-sm md:text-base text-gray-400 bg-gray-800/70 border border-gray-700/70 rounded-l-2xl select-none">
        View as
      </span>
      {/* Toggle group */}
      <div className="relative flex w-64 rounded-r-2xl bg-gray-800/70 border-t border-b border-r border-gray-700/70">
        <motion.div
          className="absolute top-1 bottom-1 w-[48%] rounded-xl shadow-lg border border-blue-400/20"
          animate={{ left: role === "ADMIN" ? 4 : 'calc(50% + 2px)' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ background: 'linear-gradient(135deg, rgba(59,130,246,.25), rgba(45,212,191,.25))' }}
        />
        <button
          onClick={() => onChange("ADMIN")}
          className={`relative z-10 w-1/2 px-6 py-2 text-sm md:text-base rounded-r-none rounded-l-xl transition-colors ${role === 'ADMIN' ? 'text-white' : 'text-gray-300 hover:text-white'}`}
        >
          Admin
        </button>
        <button
          onClick={() => onChange("CLEANER")}
          className={`relative z-10 w-1/2 px-6 py-2 text-sm md:text-base rounded-l-none rounded-r-xl transition-colors ${role === 'CLEANER' ? 'text-white' : 'text-gray-300 hover:text-white'}`}
        >
          Cleaner
        </button>
      </div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-700/60 bg-gray-800/40 p-4 md:p-5 shadow-lg shadow-black/20">
      {children}
    </div>
  )
}

function Stat({ label, value, trend }: { label: string; value: string; trend?: string }) {
  return (
    <div className="p-3 rounded-xl bg-gray-900/40 border border-gray-700/50">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {trend && <div className="text-xs text-emerald-400 mt-1">{trend}</div>}
    </div>
  )
}

function Kpi({ label, value, accent = 'text-blue-300' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="p-3 rounded-xl bg-gray-900/40 border border-gray-700/50">
      <div className="text-xs text-gray-400">{label}</div>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={`mt-1 text-2xl font-extrabold ${accent}`}
      >
        {value}
      </motion.div>
    </div>
  )
}

function SimpleBars({ values, color = 'blue' }: { values: number[]; color?: 'blue' | 'red' }) {
  const max = Math.max(1, ...values)
  const colorClasses = color === 'red'
    ? 'from-rose-600/70 to-orange-400/70 border-rose-400/30'
    : 'from-blue-600/70 to-teal-400/70 border-blue-400/20'
  return (
    <div className="h-28 flex items-end gap-2">
      {values.map((v, i) => (
        <motion.div
          key={i}
          initial={{ height: 0, opacity: 0.7 }}
          animate={{ height: `${Math.round((v / max) * 100)}%`, opacity: 1 }}
          transition={{ duration: 0.6, delay: i * 0.05 }}
          className={`w-6 rounded-md bg-gradient-to-t ${colorClasses} border`}
          title={`${v}%`}
        />
      ))}
    </div>
  )
}

// Removed InteractiveScenarios card in favor of top scenario bar and expanded Highlights

function Highlights() {
  const items = [
    { icon: Users, text: 'Live sessions', desc: 'Presence and session tracking so you can see who is online and when they were last active.' },
    { icon: Calendar, text: 'Schedules', desc: 'Each room and equipment has its own schedule with clear frequencies and next-due dates.' },
    { icon: DoorOpen, text: 'Rooms', desc: 'Create rooms, attach schedules, and track tasks and progress by location.' },
    { icon: Wrench, text: 'Equipment', desc: 'Manage maintenance schedules for equipment alongside room cleaning tasks.' },
    { icon: ShieldCheck, text: 'RBAC', desc: 'Role-based access: Admins manage, Cleaners focus on their tasks.' },
    { icon: CheckCircle2, text: 'Task tracking', desc: 'Statuses across tasks (pending, in progress, completed, overdue) with quick at-a-glance views.' },
    { icon: Bot, text: 'AI extraction', desc: 'Upload documents to automatically extract tasks and suggest schedule frequencies.' },
    { icon: Upload, text: 'Document upload', desc: 'Support for PDF/DOCX/images that feed into AI processing for schedules.' },
    { icon: Mail, text: 'Email notifications', desc: 'Future: notify responsible staff about overdue rooms or upcoming work.' },
    { icon: Clock, text: 'Cron automation', desc: 'Automated checks to keep statuses and reminders up-to-date.' },
    { icon: Activity, text: 'Health checks', desc: 'Built-in health endpoint to monitor system readiness.' },
    { icon: Gauge, text: 'Rate limiting', desc: 'Protect critical endpoints from abuse with per-user/IP limits.' },
    { icon: History, text: 'Recent activity', desc: 'Audit-friendly feed of recent actions across the system.' },
    { icon: ArrowLeftRight, text: 'Account switch', desc: 'Quickly switch between multiple stored accounts during admin sessions.' },
    { icon: KeyRound, text: 'Password policy', desc: 'Enforce password changes and block after repeated failed attempts.' },
  ]
  return (
    <Card>
      <h3 className="font-semibold">What you’ll see</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
        {items.map(({ icon, text, desc }) => (
          <Pill key={text} icon={icon} text={text} desc={desc} />
        ))}
      </div>
    </Card>
  )
}

function Pill({ icon: Icon, text, desc }: { icon: any; text: string; desc?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="relative group"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      aria-haspopup="dialog"
      aria-expanded={open}
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900/40 border border-gray-700/50 text-sm">
        <Icon className="w-4 h-4 text-blue-300" />
        <span>{text}</span>
      </div>

      {/* Hover popover */}
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: open ? 1 : 0, y: open ? 0 : 8, scale: open ? 1 : 0.98 }}
        transition={{ duration: 0.18 }}
        className={`absolute z-30 left-0 top-full mt-2 w-64 md:w-72 rounded-xl bg-gray-900/95 border border-gray-700/60 shadow-xl p-4 pointer-events-none ${open ? 'block' : 'hidden'}`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Icon className="w-6 h-6 text-teal-300" />
          </div>
          <div>
            <div className="font-semibold text-gray-100 mb-1">{text}</div>
            <div className="text-sm text-gray-300 leading-snug">{desc || 'Details coming soon.'}</div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function FeaturePanel({
  title,
  subtitle,
  items,
}: {
  title: string
  subtitle: string
  items: { icon: any; title: string; desc: string }[]
}) {
  return (
    <div className="rounded-2xl border border-gray-700/60 bg-gray-800/30 p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
      <div className="mt-4 space-y-3">
        {items.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-3">
            <div className="mt-0.5">
              <Icon className="w-4 h-4 text-teal-300" />
            </div>
            <div>
              <div className="font-medium">{title}</div>
              <div className="text-sm text-gray-400">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


function MockAdminDashboard({ scenario }: { scenario: 'normal' | 'overdue' | 'equipment' }) {
  // Mock of DashboardOverview: no API calls, static data
  const mockStats = {
    totalUsers: 18,
    totalRooms: 42,
    totalEquipment: scenario === 'equipment' ? 54 : 27,
    totalSchedules: scenario === 'overdue' ? 24 : 19,
  }
  const weekly = scenario === 'overdue' ? [35, 40, 28, 30, 25, 20, 18] : [72, 88, 64, 91, 83, 75, 95]
  const quickActions = [
    { name: 'Manage Rooms', icon: DoorOpen, description: 'Add, edit, and manage cleaning locations' },
    { name: 'Equipment', icon: Wrench, description: 'Manage maintenance equipment and schedules' },
    { name: 'Schedules', icon: Calendar, description: 'Create and manage cleaning schedules' },
    { name: 'Users', icon: Users, description: 'Manage team members and permissions' },
  ]
  const recent = ['Room 12 cleaned • Sarah J', 'Room 7 cleaned • Mark L', 'Filter replaced • Boiler A']

  return (
    <div className="max-w-7xl mx-auto relative z-10">
      <div className="mb-6">
        <h4 className="text-xl font-semibold text-gray-100">Admin Dashboard</h4>
        <p className="text-gray-400 text-sm">Mocked data preview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[{ name: 'Total Users', value: mockStats.totalUsers, icon: Users, color: 'text-blue-400' },
          { name: 'Rooms', value: mockStats.totalRooms, icon: DoorOpen, color: 'text-green-400' },
          { name: 'Equipment', value: mockStats.totalEquipment, icon: Wrench, color: 'text-orange-400' },
          { name: 'Active Schedules', value: mockStats.totalSchedules, icon: Calendar, color: 'text-purple-400' }
        ].map((stat, i) => (
          <motion.div key={stat.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="p-4 rounded-xl bg-gray-900/40 border border-gray-700/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-100 mt-1">{stat.value}</p>
              </div>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-gray-900/40 border border-gray-700/60">
          <h5 className="text-sm font-medium mb-3">Weekly Completion</h5>
          <SimpleBars values={weekly} />
        </div>
        <div className="p-4 rounded-xl bg-gray-900/40 border border-gray-700/60">
          <h5 className="text-sm font-medium mb-2">Recent Activity</h5>
          <ul className="space-y-2 text-sm text-gray-300">
            {recent.map((item, i) => (
              <li key={i} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className={scenario === 'overdue' && i === 0 ? 'text-rose-300' : ''}>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mb-2">
        <h5 className="text-sm font-medium mb-3">Quick Actions</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((a, i) => (
            <motion.div key={a.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }} className="p-4 rounded-xl bg-gray-900/40 border border-gray-700/60">
              <div className="flex items-center mb-2">
                <a.icon className="w-5 h-5 mr-2" />
                <h6 className="font-medium">{a.name}</h6>
              </div>
              <p className="text-xs text-gray-400">{a.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MockCleanerDashboard({ scenario }: { scenario: 'normal' | 'overdue' | 'equipment' }) {
  const base = [
    { room: 'Main Office', task: 'Dust & vacuum', due: 'Today', progress: 80 },
    { room: 'Kitchen', task: 'Surface sanitize', due: 'Today', progress: 45 },
    { room: 'Conference A', task: 'Glass & table', due: 'Today', progress: 10 },
  ]
  const overdueSet = [
    { room: 'Storage', task: 'Deep sweep', due: 'Overdue', progress: 0 },
    { room: 'Reception', task: 'Windows', due: 'Overdue', progress: 0 },
  ]
  const equipSet = [
    { room: 'Boiler A', task: 'Filter replace', due: 'Today', progress: 20 },
    { room: 'Air Purifier 2', task: 'Clean intake', due: 'Today', progress: 35 },
  ]
  const tasks = scenario === 'overdue' ? [...overdueSet, ...base] : scenario === 'equipment' ? [...equipSet, ...base] : base

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-semibold">Cleaner Dashboard</h4>
        <span className="text-xs text-gray-400">Mocked data preview</span>
      </div>
      <ul className="space-y-3">
        {tasks.map((item, i) => (
          <li key={i} className="p-3 rounded-xl bg-gray-900/40 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{item.room}</div>
                <div className="text-sm text-gray-400">{item.task}</div>
              </div>
              <span className={`text-xs ${item.due === 'Overdue' ? 'text-rose-300' : 'text-blue-300'}`}>{item.due}</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-gray-800/60 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${item.progress}%` }}
                transition={{ duration: 0.7, delay: i * 0.1 }}
                className={`h-full rounded-full bg-gradient-to-r ${item.due === 'Overdue' ? 'from-rose-500 to-orange-400' : 'from-blue-500 to-teal-400'}`}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
