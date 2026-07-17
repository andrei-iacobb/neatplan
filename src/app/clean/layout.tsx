"use client"

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Settings, ChevronDown, Sparkles } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useThemeColors } from '@/hooks/useThemeColors'

// Simple initial-in-circle avatar using the emerald brand accent
function Avatar({ name, size = 'sm' }: { name: string, size?: 'sm' | 'md' }) {
  const sizeClasses = {
    sm: 'w-9 h-9 text-sm',
    md: 'w-11 h-11 text-base'
  }

  const initial = (name.trim().charAt(0) || '?').toUpperCase()

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-white select-none`}
      style={{ background: 'rgb(16,185,129)' }}
      aria-hidden="true"
    >
      {initial}
    </div>
  )
}

export default function CleanLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const tc = useThemeColors()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth' })
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // If admin user, redirect to admin dashboard
  if (status === 'authenticated' && session?.user?.isAdmin) {
    router.replace('/')
    return null
  }

  const displayName = session?.user?.name || session?.user?.email || ''

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-teal-600 focus:text-white focus:rounded-md"
      >
        Skip to main content
      </a>
      {/* Simple header for cleaners */}
      <header
        className="relative z-50"
        style={{ background: tc.surfaceBg, borderBottom: `1px solid ${tc.cardBorder}` }}
        role="banner"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: 'rgb(16,185,129)' }} />
                <span className="font-bold text-xl tracking-tight" style={{ color: tc.textPrimary }}>NeatPlan</span>
              </div>
              <span className="text-sm" style={{ color: tc.textMuted }}>Cleaner Portal</span>
            </div>

            {session?.user && (
              <div className="relative" ref={dropdownRef}>
                {/* Profile Button */}
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  aria-expanded={showDropdown}
                  aria-haspopup="menu"
                  aria-label="Account menu"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 min-h-[44px]"
                  style={{ color: tc.textSecondary }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = tc.hoverRow; e.currentTarget.style.color = tc.textPrimary }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = tc.textSecondary }}
                >
                  <Avatar name={displayName} size="sm" />
                  <span className="text-sm font-medium">{displayName}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {showDropdown && (
                  <div
                    className="absolute right-0 mt-2 w-64 rounded-xl shadow-xl z-50 overflow-hidden"
                    style={{ background: tc.modalBg, border: `1px solid ${tc.cardBorder}` }}
                  >
                    <div className="py-2">
                      {/* User Info */}
                      <div className="px-4 py-3" style={{ borderBottom: `1px solid ${tc.cardBorder}` }}>
                        <div className="flex items-center gap-3">
                          <Avatar name={displayName} size="md" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate" style={{ color: tc.textPrimary }}>{session.user.name}</div>
                            <div className="text-xs truncate" style={{ color: tc.textMuted }}>{session.user.email}</div>
                          </div>
                        </div>
                      </div>

                      {/* Menu Items */}
                      <div className="py-1">
                        <Link
                          href="/clean/settings"
                          onClick={() => setShowDropdown(false)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                          style={{ color: tc.textSecondary }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = tc.hoverRow; e.currentTarget.style.color = tc.textPrimary }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = tc.textSecondary }}
                        >
                          <Settings className="w-4 h-4" strokeWidth={1.5} />
                          Settings
                        </Link>
                      </div>

                      <div className="mt-1" style={{ borderTop: `1px solid ${tc.cardBorder}` }}>
                        <button
                          onClick={() => {
                            setShowDropdown(false)
                            handleSignOut()
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                          style={{ color: tc.btnDangerText }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = tc.btnDangerBg }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <LogOut className="w-4 h-4" strokeWidth={1.5} />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      {/* Each page provides its own max-width container, so the shell stays full-width
          and the header (max-w-7xl) lines up with the dashboard content. */}
      <main id="main-content" className="py-6 pb-24 sm:pb-6">
        {children}
      </main>
    </div>
  )
}
