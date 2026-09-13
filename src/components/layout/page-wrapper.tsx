'use client'

import { ConditionalLayout } from '@/components/layout/conditional-layout'
import { Footer } from '@/components/ui/footer'
import { Fragment, Suspense } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export function PageWrapper({ children }: { children: React.ReactNode }) {
  const { bfcacheId } = useRouter()
  const pathname = usePathname()

  /*
   * Printable documents opt out of the app shell entirely. The shell pins the
   * viewport height and hides overflow, which is right for a dashboard and
   * fatal for a document: a multi-page report would be clipped to one screen
   * and the print job would carry only the first sheet.
   */
  if (pathname?.startsWith('/print')) {
    return <>{children}</>
  }

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
