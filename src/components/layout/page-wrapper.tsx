'use client'

import { ConditionalLayout } from '@/components/layout/conditional-layout'
import { Footer } from '@/components/ui/footer'
import { Fragment, Suspense } from 'react'
import { useRouter } from 'next/navigation'

export function PageWrapper({ children }: { children: React.ReactNode }) {
  const { bfcacheId } = useRouter()

  return (
    <div className="app-shell h-[100dvh] flex flex-col overflow-hidden">
      <Fragment key={bfcacheId}>
        {/*
         * The fallback deliberately holds no `children`.
         *
         * ConditionalLayout reads the pathname and the session, both runtime
         * values, so with Cache Components it is the fallback that gets
         * prerendered into the static shell while the real tree streams in.
         * When the fallback ALSO rendered `children`, every page existed twice
         * in the DOM at once - once in the prerendered shell, once in the
         * streamed content.
         *
         * That is what makes `getByPlaceholder('Email or username')` a strict
         * mode violation under parallel Playwright runs: there really are two
         * login forms for a moment. It also mounted every page's effects and
         * fetches twice on first paint.
         *
         * The chrome is what is unknown until the session resolves, so the
         * chrome is what the fallback stands in for. The content arrives with
         * the streamed tree, in the same response.
         */}
        <Suspense
          fallback={
            <div className="flex flex-col h-full">
              <main className="flex-1 overflow-auto" />
              <Footer />
            </div>
          }
        >
          <ConditionalLayout>
            {children}
          </ConditionalLayout>
        </Suspense>
      </Fragment>
    </div>
  )
}
