import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { DashboardOverview } from '@/components/dashboard/dashboard-overview'

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

  // Show admin dashboard for admin users
  return <DashboardOverview />
}
