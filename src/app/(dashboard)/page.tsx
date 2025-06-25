'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Still loading

    if (!session) {
      router.push('/auth')
      return
    }

    // TODO: Redirect to a more meaningful dashboard home
    router.push('/equipment')
  }, [session, status, router])

  if (status === 'loading') {
    return <div>Loading...</div>
  }

  return null
} 