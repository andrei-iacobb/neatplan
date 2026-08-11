'use client'

import { ConditionalLayout } from '@/components/layout/conditional-layout'
import { Footer } from '@/components/ui/footer'
import { Fragment, Suspense } from 'react'
import { useRouter } from 'next/navigation'

export function PageWrapper({ children }: { children: React.ReactNode }) {
  const { bfcacheId } = useRouter()

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <Fragment key={bfcacheId}>
        <Suspense fallback={
          <div className="flex flex-col h-full">
            <main className="flex-1 overflow-auto">{children}</main>
            <Footer />
          </div>
        }>
          <ConditionalLayout>
            {children}
          </ConditionalLayout>
        </Suspense>
      </Fragment>
    </div>
  )
}
