"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { CheckCircle, Home, Users, Calendar, Settings, LogOut, Menu, X, Upload } from "lucide-react"
import Link from "next/link"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    // Check if user is authenticated
    if (status === "unauthenticated") {
      router.push("/login")
    }

    // Handle responsive sidebar
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false)
        setIsMobile(true)
      } else {
        setIsSidebarOpen(true)
        setIsMobile(false)
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [router, status])

  // Show loading state while checking authentication
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  const handleLogout = () => {
    signOut({ callbackUrl: "/" })
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const isAdmin = session?.user?.role === "admin"

  return (
    <div className="flex h-screen bg-muted/40">
      {/* Mobile menu button */}
      {isMobile && (
        <Button variant="outline" size="icon" className="fixed top-4 left-4 z-50 md:hidden" onClick={toggleSidebar}>
          {isSidebarOpen ? <X /> : <Menu />}
        </Button>
      )}

      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-40 w-64 transform bg-background transition-transform duration-300 ease-in-out md:relative md:translate-x-0 border-r`}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center border-b px-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">CleanTrack</span>
            </Link>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            <Link
              href="/dashboard"
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Home className="mr-3 h-5 w-5" />
              Dashboard
            </Link>

            {isAdmin && (
              <Link
                href="/dashboard/staff"
                className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                <Users className="mr-3 h-5 w-5" />
                Staff
              </Link>
            )}

            <Link
              href="/dashboard/documents"
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Upload className="mr-3 h-5 w-5" />
              Documents
            </Link>

            <Link
              href="/dashboard/schedule"
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Calendar className="mr-3 h-5 w-5" />
              Schedule
            </Link>

            <Link
              href="/dashboard/settings"
              className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              <Settings className="mr-3 h-5 w-5" />
              Settings
            </Link>
          </nav>
          <div className="border-t p-4">
            <div className="mb-2 px-3 py-2">
              <p className="text-sm font-medium">{session?.user?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{session?.user?.role}</p>
            </div>
            <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}

