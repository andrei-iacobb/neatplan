'use client'

import { usePathname } from 'next/navigation'
import { ConditionalLayout } from '@/components/layout/conditional-layout'
import { Footer } from '@/components/ui/footer'

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex-1 overflow-hidden">
        <ConditionalLayout>
          {children}
        </ConditionalLayout>
      </div>
      <Footer />
    </div>
  )
} 