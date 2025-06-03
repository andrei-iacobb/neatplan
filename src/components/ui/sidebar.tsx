"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession, signOut, signIn } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from "next/navigation"
import { 
  Home, Calendar, Settings, DoorOpen, Upload, LogOut, User, ChevronDown, 
  Crown, UserCheck, Brush, UserCog, Plus, Check, X, Wrench,
  Zap, Star, Heart, Sparkles, Coffee, Gamepad2, Music, 
  Camera, Palette, Rocket, Shield, Trophy, Flame, Diamond,
  Gem, Wand2, Target, Compass, Lightbulb, Flower, Headphones,
  Fingerprint, Eye, Brain, Atom, Codesandbox, Hexagon
} from "lucide-react"
import { useEffect } from 'react'

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Rooms", href: "/rooms", icon: DoorOpen },
  { name: "Equipment", href: "/equipment", icon: Wrench },
  { name: "Schedule", href: "/schedule", icon: Calendar },
  { name: "Upload", href: "/upload", icon: Upload },
  { name: "Settings", href: "/settings", icon: Settings },
]

// Clean collection of high-quality Lucide icons only
const profileIcons = [
  Crown, Zap, Star, Heart, Sparkles, Coffee, Gamepad2, Music,
  Camera, Palette, Rocket, Shield, Trophy, Flame, Diamond,
  Gem, Wand2, Target, Compass, Lightbulb, Flower, Headphones,
  Fingerprint, Eye, Brain, Atom, Codesandbox, Hexagon
]

// Gradient color schemes for icons
const colorSchemes = [
  'from-blue-400 to-purple-500',
  'from-green-400 to-teal-500', 
  'from-pink-400 to-rose-500',
  'from-orange-400 to-red-500',
  'from-indigo-400 to-blue-500',
  'from-teal-400 to-cyan-500',
  'from-purple-400 to-pink-500',
  'from-yellow-400 to-orange-500',
  'from-emerald-400 to-green-500',
  'from-violet-400 to-purple-500'
]

// Function to consistently assign an icon and color based on user email
function getUserProfile(email: string) {
  if (!email) return { icon: Crown, gradient: 'from-gray-400 to-gray-500' }
  
  // Create a simple hash from the email
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Get consistent indices based on the hash
  const iconIndex = Math.abs(hash) % profileIcons.length
  const colorIndex = Math.abs(hash >> 8) % colorSchemes.length
  
  return {
    icon: profileIcons[iconIndex],
    gradient: colorSchemes[colorIndex]
  }
}

// Clean avatar component with high-quality rendering
function Avatar({ email, size = 'sm' }: { email: string, size?: 'sm' | 'md' | 'lg' }) {
  const { icon: IconComponent, gradient } = getUserProfile(email)
  
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10', 
    lg: 'w-12 h-12'
  }
  
  const iconSizes = {
    sm: 'w-[16px] h-[16px]',
    md: 'w-[20px] h-[20px]',
    lg: 'w-[24px] h-[24px]'
  }
  
  return (
    <div 
      className={`${sizeClasses[size]} bg-gradient-to-br ${gradient} rounded-full flex items-center justify-center relative overflow-hidden`}
      style={{
        WebkitFontSmoothing: 'antialiased',
        transform: 'translateZ(0)', // Force hardware acceleration
        backfaceVisibility: 'hidden', // Smooth rendering
        background: `linear-gradient(135deg, var(--tw-gradient-stops))`,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.15)'
      }}
    >
      {/* Inner glow effect */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/10" />
      
      {/* Icon with perfect centering */}
      <div className="relative z-10 flex items-center justify-center">
        <IconComponent 
          className={`${iconSizes[size]} text-white`} 
          strokeWidth={2.5}
          style={{
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))',
            strokeLinecap: 'round',
            strokeLinejoin: 'round'
          }}
        />
      </div>
    </div>
  )
}

// Account switcher modal
function AccountSwitcher({ 
  isOpen, 
  onClose, 
  currentSession 
}: { 
  isOpen: boolean
  onClose: () => void
  currentSession: any 
}) {
  const [savedAccounts, setSavedAccounts] = useState<any[]>([])
  const [isAddingAccount, setIsAddingAccount] = useState(false)

  useEffect(() => {
    // Load saved accounts from localStorage
    const saved = localStorage.getItem('cleantrack-accounts')
    if (saved) {
      setSavedAccounts(JSON.parse(saved))
    }
  }, [])

  const saveCurrentAccount = () => {
    if (!currentSession?.user) return
    
    const newAccount = {
      id: currentSession.user.email,
      name: currentSession.user.name,
      email: currentSession.user.email,
      isAdmin: currentSession.user.isAdmin,
      lastUsed: new Date().toISOString()
    }
    
    const existing = savedAccounts.filter(acc => acc.id !== newAccount.id)
    const updated = [newAccount, ...existing]
    
    setSavedAccounts(updated)
    localStorage.setItem('cleantrack-accounts', JSON.stringify(updated))
  }

  const switchToAccount = async (email: string) => {
    if (email === currentSession?.user?.email) {
      onClose()
      return
    }
    
    // Save current account before switching
    saveCurrentAccount()
    
    // Sign out and redirect to auth with return URL
    await signOut({ 
      callbackUrl: `/auth?email=${encodeURIComponent(email)}&returnTo=${encodeURIComponent(window.location.pathname)}`
    })
  }

  const addNewAccount = async () => {
    saveCurrentAccount()
    setIsAddingAccount(true)
    
    // Sign out and redirect to auth for new account
    await signOut({ 
      callbackUrl: `/auth?new=true&returnTo=${encodeURIComponent(window.location.pathname)}`
    })
  }

  const removeAccount = (email: string) => {
    const updated = savedAccounts.filter(acc => acc.id !== email)
    setSavedAccounts(updated)
    localStorage.setItem('cleantrack-accounts', JSON.stringify(updated))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-100">Switch Account</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current Account */}
          <div className="mb-6">
            <div className="text-sm text-gray-400 mb-2">Current Account</div>
            <div className="flex items-center gap-3 p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg">
              <Avatar email={currentSession?.user?.email || ''} size="md" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-100">{currentSession?.user?.name}</div>
                <div className="text-xs text-gray-400">{currentSession?.user?.email}</div>
                <div className="text-xs text-teal-400">
                  {currentSession?.user?.isAdmin ? 'Administrator' : 'Team Member'}
                </div>
              </div>
              <Check className="w-5 h-5 text-teal-400" />
            </div>
          </div>

          {/* Saved Accounts */}
          {savedAccounts.length > 0 && (
            <div className="mb-6">
              <div className="text-sm text-gray-400 mb-2">Saved Accounts</div>
              <div className="space-y-2">
                {savedAccounts
                  .filter(account => account.id !== currentSession?.user?.email)
                  .map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center gap-3 p-3 bg-gray-700/30 hover:bg-gray-700/50 border border-gray-600/50 rounded-lg cursor-pointer transition-colors group"
                      onClick={() => switchToAccount(account.email)}
                    >
                      <Avatar email={account.email} size="md" />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-100">{account.name}</div>
                        <div className="text-xs text-gray-400">{account.email}</div>
                        <div className="text-xs text-gray-500">
                          {account.isAdmin ? 'Administrator' : 'Team Member'}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeAccount(account.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 p-1 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Add Account */}
          <button
            onClick={addNewAccount}
            disabled={isAddingAccount}
            className="w-full flex items-center justify-center gap-3 p-3 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-300">
              {isAddingAccount ? 'Switching...' : 'Add Another Account'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

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
  const pathname = usePathname()
  const { data: session } = useSession()

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth' })
  }

  return (
    <>
      <motion.div
        initial={false}
        animate={{ 
          width: isExpanded ? 280 : 60,
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed left-0 top-0 h-full bg-gray-800/50 backdrop-blur-md border-r border-gray-700 z-40"
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Collapsed state */}
        {!isExpanded && (
          <div className="h-full flex flex-col items-center py-6">
            {/* Logo */}
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center mb-8">
              <div className="w-4 h-4 rounded bg-teal-400"></div>
            </div>

            {/* Navigation items in collapsed state */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
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
                    <Avatar email={session.user.email || ''} size="sm" />
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
                      onClick={() => setShowAccountSwitcher(true)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg transition-all bg-gray-700/20 hover:bg-gray-700/40 cursor-pointer"
                    >
                      <Avatar email={session.user.email || ''} size="md" />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-gray-100 truncate">
                          {session.user.name || session.user.email}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {session.user.isAdmin ? 'Administrator' : 'Team Member'}
                        </p>
                      </div>
                      <UserCog className="w-4 h-4 text-gray-400" />
                    </button>
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

      {/* Account Switcher Modal */}
      <AccountSwitcher 
        isOpen={showAccountSwitcher}
        onClose={() => setShowAccountSwitcher(false)}
        currentSession={session}
      />
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