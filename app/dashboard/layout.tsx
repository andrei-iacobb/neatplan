"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { CheckCircle, Home, Users, ClipboardList, Settings, LogOut, Menu, X, Upload, Bell, QrCode } from "lucide-react"
import Link from "next/link"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const router = useRouter()
  const pathname = usePathname()
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

    // Fetch unread notifications count
    if (status === "authenticated") {
      fetchUnreadNotifications()
    }

    return () => window.removeEventListener("resize", handleResize)
  }, [router, status])

  const fetchUnreadNotifications = async () => {
    try {
      const response = await fetch("/api/notifications?is_read=false")
      if (response.ok) {
        const data = await response.json()
        setUnreadNotifications(data.length)
      }
    } catch (error) {
      console.error("Error fetching notifications:", error)
    }
  }

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
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                pathname === "/dashboard" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <Home className="mr-3 h-5 w-5" />
              Dashboard
            </Link>

            <Link
              href="/dashboard/rooms"
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                pathname?.startsWith("/dashboard/rooms") ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <ClipboardList className="mr-3 h-5 w-5" />
              Rooms & Tasks
            </Link>

            <Link
              href="/dashboard/scan"
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                pathname === "/dashboard/scan" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <QrCode className="mr-3 h-5 w-5" />
              Scan Room
            </Link>

            <Link
              href="/dashboard/notifications"
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                pathname === "/dashboard/notifications" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <div className="relative mr-3">
                <Bell className="h-5 w-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unreadNotifications > 9 ? "9+" : unreadNotifications}
                  </span>
                )}
              </div>
              Notifications
            </Link>

            {isAdmin && (
              <>
                <Link
                  href="/dashboard/staff"
                  className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                    pathname === "/dashboard/staff" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <Users className="mr-3 h-5 w-5" />
                  Staff
                </Link>

                <Link
                  href="/dashboard/documents"
                  className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                    pathname === "/dashboard/documents" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <Upload className="mr-3 h-5 w-5" />
                  Documents
                </Link>
              </>
            )}

            <Link
              href="/dashboard/settings"
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                pathname === "/dashboard/settings" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
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
