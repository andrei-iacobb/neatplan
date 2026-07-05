"use client"

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Sidebar } from '@/components/ui/sidebar'
import { Footer } from '@/components/ui/footer'

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
      <div className="flex h-full">
        <Sidebar />
        <div className="flex-1 flex flex-col md:ml-[60px] min-h-0 relative z-10">
          <main className="flex-1 overflow-auto p-4 sm:p-6 pt-16 md:pt-6 relative">
            {children}
          </main>
          <Footer />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 overflow-auto">{children}</main>
      <Footer />
    </div>
  )
} 