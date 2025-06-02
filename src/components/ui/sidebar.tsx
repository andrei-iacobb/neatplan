"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from "next/navigation"
import { Home, Calendar, Settings, DoorOpen, Upload, LogOut, User, ChevronDown, Crown, UserCheck, Brush } from "lucide-react"
import { useMultiUser } from '@/hooks/useMultiUser'

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Rooms", href: "/rooms", icon: DoorOpen },
  { name: "Schedule", href: "/schedule", icon: Calendar },
  { name: "Upload", href: "/upload", icon: Upload },
  { name: "Settings", href: "/settings", icon: Settings },
]

// Helper function to get user icon based on role/admin status
function getUserIcon(isAdmin: boolean) {
  if (isAdmin) return Crown
  return UserCheck // Default for non-admin users
}

// Helper function to get user color scheme
function getUserColors(isAdmin: boolean) {
  if (isAdmin) {
    return {
      color: 'text-red-300',
      bgColor: 'bg-red-500/20',
      hoverColor: 'hover:bg-red-500/30'
    }
  }
  return {
    color: 'text-blue-300',
    bgColor: 'bg-blue-500/20',
    hoverColor: 'hover:bg-blue-500/30'
  }
}

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false)
  const { data: session } = useSession()
  const { availableSessions, isLoading, switchToAccount } = useMultiUser()
  const pathname = usePathname()

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth' })
  }

  const handleAccountSwitch = async (email: string) => {
    setShowAccountSwitcher(false)
    await switchToAccount(email)
  }

  const currentUserColors = getUserColors(session?.user?.isAdmin || false)
  const CurrentUserIcon = getUserIcon(session?.user?.isAdmin || false)

  return (
    <>
      {/* Mobile overlay */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsExpanded(false)}
        />
      )}
      
      <motion.div
        className="fixed left-0 top-0 h-full z-50"
        initial={{ width: '60px' }}
        animate={{ width: isExpanded ? '280px' : '60px' }}
        transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        onClick={() => {
          // On mobile, toggle expansion on click
          if (window.innerWidth < 768) {
            setIsExpanded(!isExpanded)
          }
        }}
      >
        {/* Background */}
        <motion.div
          className="absolute inset-0 bg-gray-800/50 backdrop-blur-sm border-r border-gray-700"
          initial={{ opacity: 0.8 }}
          animate={{ opacity: isExpanded ? 1 : 0.8 }}
          transition={{ duration: 0.3 }}
        />

        {/* Collapsed state - centered menu icon */}
        {!isExpanded && (
          <div className="absolute left-0 top-8 w-full">
            <div className="relative z-10 m-3">
              <div className="flex flex-col items-center space-y-4">
                {/* Logo */}
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
                  <div className="w-4 h-4 rounded bg-teal-400"></div>
                </div>
                
                {/* Menu items */}
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`p-2 rounded-lg transition-colors group relative ${
                      pathname === item.href
                        ? "bg-teal-500/20 text-teal-300"
                        : "text-gray-400 hover:text-teal-300 hover:bg-gray-700/50"
                    }`}
                    title={item.name}
                  >
                    <item.icon className="w-5 h-5" />
                    {pathname === item.href && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute inset-0 bg-teal-500/20 rounded-lg border border-teal-500/30"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </Link>
                ))}

                {/* User avatar in collapsed state */}
                {session && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-teal-400" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Expanded state */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative h-full flex flex-col"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
                    <div className="w-5 h-5 rounded bg-teal-400"></div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-100">CleanTrack</h2>
                    <p className="text-xs text-gray-400">
                      {session?.user?.isAdmin ? 'Admin Panel' : 'Team Portal'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 p-4 space-y-2">
                {navigation.map((item) => (
                  <NavLink 
                    key={item.name} 
                    href={item.href}
                    isActive={pathname === item.href}
                    icon={<item.icon className="w-5 h-5" />}
                  >
                    {item.name}
                  </NavLink>
                ))}
              </nav>

              {/* Account Section */}
              {session && (
                <div className="p-4 border-t border-gray-700">
                  {/* Current User Display with Switch Functionality */}
                  <div className="relative mb-3">
                    <button
                      onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
                      disabled={isLoading}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                        currentUserColors.bgColor
                      } ${currentUserColors.hoverColor} ${
                        isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentUserColors.bgColor}`}>
                        <CurrentUserIcon className={`w-4 h-4 ${currentUserColors.color}`} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-gray-100 truncate">
                          {session.user.name || session.user.email}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {session.user.isAdmin ? 'Administrator' : 'Team Member'}
                        </p>
                      </div>
                      {availableSessions.length > 0 && (
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${
                          showAccountSwitcher ? 'rotate-180' : ''
                        }`} />
                      )}
                    </button>

                    {/* Account Switcher Dropdown */}
                    <AnimatePresence>
                      {showAccountSwitcher && availableSessions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800/95 backdrop-blur-md border border-gray-600 rounded-lg shadow-xl overflow-hidden"
                        >
                          <div className="p-2">
                            <div className="text-xs text-gray-400 px-3 py-2 font-medium">Switch Account</div>
                            {availableSessions.map((sessionData) => {
                              const sessionColors = getUserColors(sessionData.isAdmin)
                              const SessionIcon = getUserIcon(sessionData.isAdmin)
                              
                              return (
                                <button
                                  key={sessionData.email}
                                  onClick={() => handleAccountSwitch(sessionData.email)}
                                  disabled={isLoading}
                                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                                    sessionColors.hoverColor
                                  } disabled:opacity-50`}
                                >
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${sessionColors.bgColor}`}>
                                    <SessionIcon className={`w-3 h-3 ${sessionColors.color}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-100 truncate">
                                      {sessionData.name}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate">
                                      {sessionData.isAdmin ? 'Administrator' : 'Team Member'}
                                    </p>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Sign Out Button */}
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  )
}

function NavLink({ 
  href, 
  children, 
  isActive, 
  icon 
}: { 
  href: string
  children: React.ReactNode
  isActive: boolean
  icon: React.ReactNode
}) {
  return (
    <Link 
      href={href} 
      className={`relative flex items-center gap-3 px-3 py-3 text-sm rounded-lg transition-all duration-200 ${
        isActive 
          ? "text-teal-300 bg-teal-500/10 border border-teal-500/20" 
          : "text-gray-300 hover:text-gray-100 hover:bg-gray-700/50"
      }`}
    >
      {isActive && (
        <motion.div
          layoutId="activeNavItem"
          className="absolute inset-0 bg-teal-500/10 rounded-lg border border-teal-500/20"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <div className="relative z-10 flex items-center gap-3">
        {icon}
        <span className="font-medium">{children}</span>
      </div>
    </Link>
  )
} 