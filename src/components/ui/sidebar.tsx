"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession, signOut, signIn } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from "next/navigation"
import { Home, Calendar, Settings, DoorOpen, Upload, LogOut, User, BarChart3, Plus, ChevronDown, Check } from "lucide-react"
import { useMultiUser } from '@/hooks/useMultiUser'

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Rooms", href: "/rooms", icon: DoorOpen },
  { name: "Schedule", href: "/schedule", icon: Calendar },
  { name: "Upload", href: "/upload", icon: Upload },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false)
  const { data: session } = useSession()
  const pathname = usePathname()
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false)
  const [isAddingAccount, setIsAddingAccount] = useState(false)

  const { storedUsers, currentUser, removeStoredUser, switchAccount } = useMultiUser()

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth' })
  }

  const handleAddAccount = async () => {
    setIsAddingAccount(true)
    setShowAccountSwitcher(false)
    
    // Store the current page to return to after adding account
    sessionStorage.setItem('add_account_return_url', pathname)
    
    // Sign out current user first to show login form
    await signOut({ 
      redirect: true, 
      callbackUrl: '/auth?mode=add-account'
    })
    
    setIsAddingAccount(false)
  }

  const handleSwitchAccount = async (email: string) => {
    setShowAccountSwitcher(false)
    
    // If it's the same user, do nothing
    if (session?.user?.email === email) return

    try {
      const success = await switchAccount(email)
      if (success) {
        // Refresh the page to load the new session
        window.location.reload()
      } else {
        // Fallback to traditional sign out/in
        console.log('Switch account failed, falling back to sign out/in')
        sessionStorage.setItem('return_to_page', pathname)
        await signOut({ redirect: false })
        await signIn(undefined, { 
          callbackUrl: sessionStorage.getItem('return_to_page') || '/',
        })
      }
    } catch (error) {
      console.error('Error switching accounts:', error)
      // Fallback to traditional sign out/in
      sessionStorage.setItem('return_to_page', pathname)
      await signOut({ redirect: false })
      await signIn(undefined, { 
        callbackUrl: sessionStorage.getItem('return_to_page') || '/',
      })
    }
  }

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
                {currentUser && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-teal-400" />
                    </div>
                    {storedUsers.length > 1 && (
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-1 mx-auto"></div>
                    )}
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
                      {session?.user?.isAdmin ? 'Admin Panel' : 'Cleaner Portal'}
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

              {/* Account Switcher Section */}
              {currentUser && (
                <div className="p-4 border-t border-gray-700">
                  {/* Account Switcher */}
                  <div className="relative mb-3">
                    <button
                      onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-teal-400" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-gray-100 truncate">
                          {currentUser.name || 'User'}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {currentUser.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {storedUsers.length > 1 && (
                          <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showAccountSwitcher ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Account Switcher Dropdown */}
                    <AnimatePresence>
                      {showAccountSwitcher && (
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl overflow-hidden z-[100]"
                        >
                          <div className="p-2">
                            <div className="text-xs text-gray-400 px-2 py-1 mb-1">Switch Account</div>
                            
                            {/* Current account */}
                            <div className="flex items-center gap-3 p-2 rounded bg-teal-500/10 border border-teal-500/20">
                              <div className="w-6 h-6 rounded-full bg-teal-500/20 flex items-center justify-center">
                                <User className="w-3 h-3 text-teal-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-100 truncate">
                                  {currentUser.name}
                                </p>
                                <p className="text-[10px] text-gray-400 truncate">
                                  {currentUser.email}
                                </p>
                              </div>
                              <Check className="w-3 h-3 text-teal-400" />
                            </div>

                            {/* Other stored accounts */}
                            {storedUsers
                              .filter(user => user.email !== currentUser.email)
                              .map((user) => (
                              <button
                                key={user.email}
                                onClick={() => handleSwitchAccount(user.email)}
                                className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-700/50 transition-colors group"
                              >
                                <div className="w-6 h-6 rounded-full bg-gray-600/50 flex items-center justify-center">
                                  <User className="w-3 h-3 text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                  <p className="text-xs font-medium text-gray-200 truncate">
                                    {user.name}
                                  </p>
                                  <p className="text-[10px] text-gray-400 truncate">
                                    {user.email}
                                  </p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeStoredUser(user.email)
                                  }}
                                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all p-1"
                                >
                                  <LogOut className="w-3 h-3" />
                                </button>
                              </button>
                            ))}

                            {/* Add Account */}
                            <button
                              onClick={handleAddAccount}
                              disabled={isAddingAccount}
                              className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-700/50 transition-colors border-t border-gray-700 mt-2 pt-2"
                            >
                              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <Plus className="w-3 h-3 text-blue-400" />
                              </div>
                              <span className="text-xs text-blue-300">
                                {isAddingAccount ? 'Adding...' : 'Add Account'}
                              </span>
                            </button>
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
                    Sign Out All
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