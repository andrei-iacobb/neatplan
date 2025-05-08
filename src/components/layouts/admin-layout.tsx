"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/router"
import { signOut, useSession } from "next-auth/react"
import { Button } from "~/components/ui/button"
import { CheckCircle, BarChart, Users, Settings, LogOut, Menu, X, FileText, Home, ClipboardList } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { ThemeToggle } from "~/components/theme-toggle"

interface AdminLayoutProps {
  children: ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const { data: sessionData } = useSession()

  useEffect(() => {
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
  }, [])

  const handleLogout = () => {
    void signOut({ callbackUrl: "/" })
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

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
            <Link href="/admin" className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-teal-600" />
              <span className="text-xl font-bold">CleanTrack Admin</span>
            </Link>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            <Link
              href="/admin"
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                router.pathname === "/admin" ? "bg-teal-600 text-white" : "hover:bg-muted"
              }`}
            >
              <BarChart className="mr-3 h-5 w-5" />
              Dashboard
            </Link>

            <Link
              href="/admin/staff"
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                router.pathname.startsWith("/admin/staff") ? "bg-teal-600 text-white" : "hover:bg-muted"
              }`}
            >
              <Users className="mr-3 h-5 w-5" />
              Staff Management
            </Link>

            <Link
              href="/admin/rooms"
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                router.pathname.startsWith("/admin/rooms") ? "bg-teal-600 text-white" : "hover:bg-muted"
              }`}
            >
              <Home className="mr-3 h-5 w-5" />
              Rooms & Buildings
            </Link>

            <Link
              href="/admin/tasks"
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                router.pathname.startsWith("/admin/tasks") ? "bg-teal-600 text-white" : "hover:bg-muted"
              }`}
            >
              <ClipboardList className="mr-3 h-5 w-5" />
              Task Management
            </Link>

            <Link
              href="/admin/documents"
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                router.pathname.startsWith("/admin/documents") ? "bg-teal-600 text-white" : "hover:bg-muted"
              }`}
            >
              <FileText className="mr-3 h-5 w-5" />
              Document History
            </Link>

            <Link
              href="/admin/settings"
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                router.pathname === "/admin/settings" ? "bg-teal-600 text-white" : "hover:bg-muted"
              }`}
            >
              <Settings className="mr-3 h-5 w-5" />
              Settings
            </Link>

            <Link
              href="/dashboard"
              className={`flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-muted`}
            >
              <Home className="mr-3 h-5 w-5" />
              Cleaner Dashboard
            </Link>
          </nav>
          <div className="border-t p-4">
            <div className="mb-2 px-3 py-2">
              <p className="text-sm font-medium">{sessionData?.user?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{sessionData?.user?.role}</p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" className="w-full justify-start" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
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
