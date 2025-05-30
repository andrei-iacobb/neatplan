"use client"

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { LogOut, User } from 'lucide-react'

export default function CleanLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth' })
  }

  // If admin user, redirect to admin dashboard
  if (status === 'authenticated' && session?.user?.isAdmin) {
    router.replace('/')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Simple header for cleaners */}
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-teal-400 font-bold text-xl">CleanTrack</div>
              <span className="text-gray-400 text-sm">Cleaner Portal</span>
            </div>
            
            {session?.user && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-gray-300">
                  <User className="w-4 h-4" />
                  <span className="text-sm">{session.user.name || session.user.email}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main>{children}</main>
    </div>
  )
} 