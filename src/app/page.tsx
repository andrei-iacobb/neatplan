import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function HomePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth')
  }

  // Redirect to appropriate dashboard based on user role
  if (session.user?.isAdmin) {
    redirect('/equipment')
  } else {
    redirect('/clean')
  }
}
