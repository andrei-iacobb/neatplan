"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { Users, DoorOpen, Wrench, Calendar, CheckCircle2 } from "lucide-react"

type DemoRole = "ADMIN" | "CLEANER"

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-700/60 bg-gray-800/40 p-4 md:p-5 shadow-lg shadow-black/20">
      {children}
    </div>
  )
}

export default function DemoFullView() {
  const [role, setRole] = useState<DemoRole>("ADMIN")
  const [scenario, setScenario] = useState<'normal' | 'overdue' | 'equipment'>('normal')

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 pt-10 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Demo View</h1>
          <Link href="/demo" className="text-sm text-gray-300 hover:text-white">Back to demo</Link>
        </div>

        {/* Role & scenario controls */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div className="relative flex w-64 rounded-2xl bg-gray-800/70 border border-gray-700/70">
            <motion.div
              className="absolute top-1 bottom-1 w-[48%] rounded-xl shadow-lg border border-blue-400/20"
              animate={{ left: role === "ADMIN" ? 4 : 'calc(50% + 2px)' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,.25), rgba(45,212,191,.25))' }}
            />
            <button onClick={() => setRole("ADMIN")} className={`relative z-10 w-1/2 px-6 py-2 text-sm rounded-l-xl ${role === 'ADMIN' ? 'text-white' : 'text-gray-300 hover:text-white'}`}>Admin</button>
            <button onClick={() => setRole("CLEANER")} className={`relative z-10 w-1/2 px-6 py-2 text-sm rounded-r-xl ${role === 'CLEANER' ? 'text-white' : 'text-gray-300 hover:text-white'}`}>Cleaner</button>
          </div>

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
        </div>

        <Card>
          {role === 'ADMIN' ? <AdminMock scenario={scenario} /> : <CleanerMock scenario={scenario} />}
        </Card>
      </div>
    </main>
  )
}

function StatBox({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
  return (
    <div className="p-4 rounded-xl bg-gray-900/40 border border-gray-700/60">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-xs">{label}</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">{value}</p>
        </div>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
    </div>
  )
}

function AdminMock({ scenario }: { scenario: 'normal' | 'overdue' | 'equipment' }) {
  const stats = {
    users: 18,
    rooms: 42,
    equipment: scenario === 'equipment' ? 54 : 27,
    schedules: scenario === 'overdue' ? 24 : 19
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatBox label="Total Users" value={stats.users} icon={Users} color="text-blue-400" />
        <StatBox label="Rooms" value={stats.rooms} icon={DoorOpen} color="text-green-400" />
        <StatBox label="Equipment" value={stats.equipment} icon={Wrench} color="text-orange-400" />
        <StatBox label="Active Schedules" value={stats.schedules} icon={Calendar} color="text-purple-400" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-gray-900/40 border border-gray-700/60">
          <h5 className="text-sm font-medium mb-3">Weekly Completion</h5>
          <SimpleBars values={scenario === 'overdue' ? [35, 40, 28, 30, 25, 20, 18] : [72, 88, 64, 91, 83, 75, 95]} />
        </div>
        <div className="p-4 rounded-xl bg-gray-900/40 border border-gray-700/60">
          <h5 className="text-sm font-medium mb-2">Recent Activity</h5>
          <ul className="space-y-2 text-sm text-gray-200">
            {['Room 12 cleaned • Sarah J', 'Room 7 cleaned • Mark L', 'Filter replaced • Boiler A'].map((item, i) => (
              <li key={i} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function CleanerMock({ scenario }: { scenario: 'normal' | 'overdue' | 'equipment' }) {
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
      <ul className="space-y-3">
        {tasks.map((item, i) => (
          <li key={i} className="p-3 rounded-xl bg-gray-900/40 border border-gray-700/60">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{item.room}</div>
                <div className="text-sm text-gray-400">{item.task}</div>
              </div>
              <span className="text-xs text-blue-300">{item.due}</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-gray-800/60 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${item.progress}%` }} transition={{ duration: 0.7, delay: i * 0.1 }} className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-400" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SimpleBars({ values, color = 'blue' }: { values: number[]; color?: 'blue' | 'red' }) {
  const max = Math.max(1, ...values)
  return (
    <div className="h-28 flex items-end gap-2">
      {values.map((v, i) => (
        <motion.div
          key={i}
          initial={{ height: 0, opacity: 0.7 }}
          animate={{ height: `${Math.round((v / max) * 100)}%`, opacity: 1 }}
          transition={{ duration: 0.6, delay: i * 0.05 }}
          className={`w-6 rounded-md bg-gradient-to-t ${color === 'red' ? 'from-rose-600/70 to-orange-400/70 border border-rose-400/30' : 'from-blue-600/70 to-teal-400/70 border border-blue-400/20'}`}
          title={`${v}`}
        />
      ))}
    </div>
  )
}


