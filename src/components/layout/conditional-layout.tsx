"use client"

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Sidebar } from '@/components/ui/sidebar'

interface ConditionalLayoutProps {
  children: React.ReactNode
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  // Routes that should not have a sidebar
  const noSidebarRoutes = ['/auth', '/clean']
  
  // Check if current route should not have a sidebar
  const shouldHideSidebar = noSidebarRoutes.some(route => pathname.startsWith(route))
  
  // Also hide sidebar if user is not authenticated
  const showSidebar = status === 'authenticated' && !shouldHideSidebar

  if (showSidebar) {
    return (
      <div className="min-h-screen">
        <Sidebar />
        <main className="pl-[60px] transition-[padding] duration-300 ease-in-out">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {children}
    </div>
  )
} 