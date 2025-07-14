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
      <div className="h-screen flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto ml-[60px]">
          <div className="h-full p-6">
            {children}
          </div>
        </main>
      </div>
    )
  }

  return <main className="h-screen overflow-auto">{children}</main>
} 