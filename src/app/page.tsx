'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Still loading

    if (!session) {
      router.push('/auth')
      return
    }

    // Redirect to appropriate dashboard based on user role
    if (session.user?.isAdmin) {
      router.push('/equipment')
    } else {
      router.push('/clean')
    }
  }, [session, status, router])

  if (status === 'loading') {
    return <div>Loading...</div>
  }

  return null
}
