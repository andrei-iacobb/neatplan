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
} from "lucide-react"

type DemoRole = "ADMIN" | "CLEANER"

export default function DemoPage() {
  const [role, setRole] = useState<DemoRole>("ADMIN")

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

          {/* Role Segmented Control */}
          <SegmentedRoleToggle role={role} onChange={setRole} />
        </div>
      </section>

      {/* Preview */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <motion.div
          key={role}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {role === "ADMIN" ? <AdminPreview /> : <CleanerPreview />}
          <Highlights />
        </motion.div>
      </section>

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
    <div className="relative mt-8 inline-flex rounded-2xl bg-gray-800/70 border border-gray-700/70">
      <motion.div
        className="absolute top-1 bottom-1 w-1/2 rounded-xl"
        animate={{ left: role === "ADMIN" ? 4 : '50%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{ background: 'linear-gradient(135deg, rgba(59,130,246,.25), rgba(45,212,191,.25))' }}
      />
      <button
        onClick={() => onChange("ADMIN")}
        className={`relative z-10 px-6 py-2 text-sm md:text-base rounded-2xl transition-colors ${role === 'ADMIN' ? 'text-white' : 'text-gray-300 hover:text-white'}`}
      >
        <span className="opacity-70 mr-2">View as</span> Admin
      </button>
      <button
        onClick={() => onChange("CLEANER")}
        className={`relative z-10 px-6 py-2 text-sm md:text-base rounded-2xl transition-colors ${role === 'CLEANER' ? 'text-white' : 'text-gray-300 hover:text-white'}`}
      >
        Cleaner
      </button>
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

function SimpleBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values)
  return (
    <div className="h-28 flex items-end gap-2">
      {values.map((v, i) => (
        <motion.div
          key={i}
          initial={{ height: 0, opacity: 0.7 }}
          animate={{ height: `${Math.round((v / max) * 100)}%`, opacity: 1 }}
          transition={{ duration: 0.6, delay: i * 0.05 }}
          className="w-6 rounded-md bg-gradient-to-t from-blue-600/70 to-teal-400/70 border border-blue-400/20"
          title={`${v}%`}
        />
      ))}
    </div>
  )
}

function AdminPreview() {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Admin Overview</h3>
        <span className="text-xs text-gray-400">interactive demo</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <Kpi label="Active Cleaners" value="12" accent="text-emerald-400" />
        <Kpi label="Rooms Overdue" value="5" accent="text-rose-400" />
        <Kpi label="Equipment Due" value="7" accent="text-amber-300" />
        <Kpi label="Today’s Tasks" value="84" accent="text-blue-300" />
      </div>

      {/* Chart + Activity */}
      <div className="mt-5 grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-gray-900/40 border border-gray-700/50">
          <h4 className="text-sm font-medium mb-3">Weekly Completion</h4>
          <SimpleBars values={[72, 88, 64, 91, 83, 75, 95]} />
        </div>

        <div className="p-4 rounded-xl bg-gray-900/40 border border-gray-700/50">
          <h4 className="text-sm font-medium mb-2">Recent Activity</h4>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Room 12 cleaned • Sarah J</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Room 7 cleaned • Mark L</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Filter replaced • Boiler A</li>
          </ul>
        </div>
      </div>

      {/* CTAs (disabled in demo) */}
      <div className="mt-4 flex gap-3">
        <button className="px-4 py-2 rounded-lg bg-blue-600/60 text-white border border-blue-500/40 cursor-not-allowed" title="Demo only">Open Admin Dashboard</button>
        <button className="px-4 py-2 rounded-lg bg-gray-700/60 text-gray-300 border border-gray-600 cursor-not-allowed" title="Demo only">Export Report</button>
      </div>
    </Card>
  )
}

function CleanerPreview() {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Cleaner Today</h3>
        <span className="text-xs text-gray-400">sample route</span>
      </div>
      <ul className="mt-3 space-y-3">
        {[
          { room: "Main Office", task: "Dust & vacuum", due: "Today", progress: 80 },
          { room: "Kitchen", task: "Surface sanitize", due: "Today", progress: 45 },
          { room: "Conference A", task: "Glass & table", due: "Today", progress: 10 },
        ].map((item, i) => (
          <li key={i} className="p-3 rounded-xl bg-gray-900/40 border border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{item.room}</div>
                <div className="text-sm text-gray-400">{item.task}</div>
              </div>
              <span className="text-xs text-blue-300">{item.due}</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-gray-800/60 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${item.progress}%` }}
                transition={{ duration: 0.7, delay: i * 0.1 }}
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-400"
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid md:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-gray-900/40 border border-gray-700/50">
          <h4 className="text-sm font-medium mb-2">Quick Tips</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Prioritize overdue rooms first</li>
            <li>• Mark each task as soon as completed</li>
            <li>• Check equipment tasks after lunch</li>
          </ul>
        </div>
        <div className="p-3 rounded-xl bg-gray-900/40 border border-gray-700/50">
          <h4 className="text-sm font-medium mb-2">Shift Summary</h4>
          <div className="text-sm text-gray-300">3/12 tasks completed • ETA 4h 10m</div>
        </div>
      </div>

      <div className="mt-4">
        <button className="px-4 py-2 rounded-lg bg-teal-600/60 text-white border border-teal-500/40 cursor-not-allowed" title="Demo only">Open Cleaner Portal</button>
      </div>
    </Card>
  )
}

function Highlights() {
  return (
    <Card>
      <h3 className="font-semibold">What you’ll see</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
        <Pill icon={Users} text="Live sessions" />
        <Pill icon={Calendar} text="Schedules" />
        <Pill icon={DoorOpen} text="Rooms" />
        <Pill icon={Wrench} text="Equipment" />
        <Pill icon={ShieldCheck} text="RBAC" />
        <Pill icon={CheckCircle2} text="Task tracking" />
      </div>
    </Card>
  )
}

function Pill({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900/40 border border-gray-700/50 text-sm">
      <Icon className="w-4 h-4 text-blue-300" />
      <span>{text}</span>
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


