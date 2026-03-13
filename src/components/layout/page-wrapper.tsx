'use client'

import { ConditionalLayout } from '@/components/layout/conditional-layout'

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <ConditionalLayout>
        {children}
      </ConditionalLayout>
    </div>
  )
}
