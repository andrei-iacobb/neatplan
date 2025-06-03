"use client"

import { useSession, signOut, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  LogOut, Settings, UserCog, ChevronDown, Plus, Check, X,
  Crown, Zap, Star, Heart, Sparkles, Coffee, Gamepad2, Music, 
  Camera, Palette, Rocket, Shield, Trophy, Flame, Diamond,
  Gem, Wand2, Target, Compass, Lightbulb, Flower, Headphones,
  Fingerprint, Eye, Brain, Atom, Codesandbox, Hexagon
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

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
function Avatar({ email, size = 'sm' }: { email: string, size?: 'sm' | 'md' }) {
  const { icon: IconComponent, gradient } = getUserProfile(email)
  
  const sizeClasses = {
    sm: 'w-9 h-9',
    md: 'w-11 h-11'
  }
  
  const iconSizes = {
    sm: 'w-[18px] h-[18px]',
    md: 'w-[22px] h-[22px]'
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
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

export default function CleanLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false)
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
              <div className="relative" ref={dropdownRef}>
                {/* Profile Button */}
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-3 px-3 py-2 text-gray-300 hover:text-gray-100 hover:bg-gray-700/50 rounded-lg transition-all duration-200 group"
                >
                  <Avatar email={session.user.email || ''} size="sm" />
                  <span className="text-sm font-medium">{session.user.name || session.user.email}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-gray-800/95 backdrop-blur-md border border-gray-700/50 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="py-2">
                      {/* User Info */}
                      <div className="px-4 py-3 border-b border-gray-700/50 bg-gray-750/30">
                        <div className="flex items-center gap-3">
                          <Avatar email={session.user.email || ''} size="md" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-100 truncate">{session.user.name}</div>
                            <div className="text-xs text-gray-400 truncate">{session.user.email}</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Menu Items */}
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setShowDropdown(false)
                            setShowAccountSwitcher(true)
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-gray-100 hover:bg-gray-700/50 transition-colors"
                        >
                          <UserCog className="w-4 h-4" strokeWidth={1.5} />
                          Switch Account
                        </button>
                        
                        <button
                          onClick={() => {
                            setShowDropdown(false)
                            router.push('/settings')
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-gray-100 hover:bg-gray-700/50 transition-colors"
                        >
                          <Settings className="w-4 h-4" strokeWidth={1.5} />
                          Settings
                        </button>
                      </div>
                      
                      <div className="border-t border-gray-700/50 mt-1">
                        <button
                          onClick={() => {
                            setShowDropdown(false)
                            handleSignOut()
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
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

      {/* Account Switcher Modal */}
      <AccountSwitcher 
        isOpen={showAccountSwitcher}
        onClose={() => setShowAccountSwitcher(false)}
        currentSession={session}
      />

      {/* Main content */}
      <main>{children}</main>
    </div>
  )
} 