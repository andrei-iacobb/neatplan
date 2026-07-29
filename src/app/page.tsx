import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardOverview } from '@/components/dashboard/dashboard-overview'
import { PageLoading } from '@/components/ui/loading'

// Force dynamic rendering to prevent build issues
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth')
  }

  // Redirect cleaners to their dashboard
  if (!session.user?.isAdmin) {
    redirect('/clean')
  }

  // The dashboard reads the `?site=` param through useSearchParams, which needs
  // a Suspense boundary above it.
  return (
    <Suspense fallback={
      <div className="max-w-[1230px] mx-auto relative z-10 pb-[17px]">
        <PageLoading cards={4} columns={4} label="Loading dashboard" />
      </div>
    }>
      <DashboardOverview />
    </Suspense>
  )
}
