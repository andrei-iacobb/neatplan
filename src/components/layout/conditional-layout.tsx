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
      <div className="min-h-screen flex flex-col">
        <Sidebar />
        <main className="flex-1 pl-[60px] transition-[padding] duration-300 ease-in-out">
          {children}
        </main>
        <div className="pl-[60px] transition-[padding] duration-300 ease-in-out">
          <Footer />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
} 