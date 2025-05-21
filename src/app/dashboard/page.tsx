"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-teal-400 text-lg font-light">Loading...</p>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-6 py-8">
        <div className="grid gap-6">
          <div className="backdrop-blur-sm bg-black/10 rounded-lg p-6 shadow-xl border border-white/5">
            <h2 className="text-xl font-light text-teal-300 mb-4">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                <p className="text-2xl font-light text-teal-400">0</p>
                <p className="text-sm text-gray-400">Tasks in Progress</p>
              </div>
              <div className="bg-white/5 p-4 rounded-lg border border-white/5">
                <p className="text-2xl font-light text-teal-400">0</p>
                <p className="text-sm text-gray-400">Completed Tasks</p>
              </div>
            </div>
          </div>

          <div className="backdrop-blur-sm bg-black/10 rounded-lg p-6 shadow-xl border border-white/5">
            <h2 className="text-xl font-light text-teal-300 mb-4">Recent Activity</h2>
            <div className="bg-white/5 p-4 rounded-lg border border-white/5">
              <p className="text-gray-400 text-sm">No recent activity</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
} 