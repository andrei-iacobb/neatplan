"use client"

import { Sidebar } from "@/components/ui/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="pl-[240px]">
        {children}
      </main>
    </div>
  )
} 