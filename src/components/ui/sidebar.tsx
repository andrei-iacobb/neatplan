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
import { Logo, LogoWithText } from "@/components/ui/logo"

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

// Simple hash function for consistent color assignment
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

// Get user profile based on email
function getUserProfile(email: string) {
  const hash = simpleHash(email)
  const iconIndex = hash % profileIcons.length
  const colorIndex = hash % colorSchemes.length
  
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

// Account switcher component
function AccountSwitcher({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleSignOut = async () => {
    setIsSigningOut(true)
    await signOut({ callbackUrl: '/auth' })
  }

  const handleAddAccount = () => {
    window.location.href = '/auth?new=true&returnTo=' + encodeURIComponent(window.location.pathname)
  }

  const handleSwitchAccount = () => {
    window.location.href = '/auth?returnTo=' + encodeURIComponent(window.location.pathname)
  }

  if (!session?.user) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50"
    >
      {/* Current Account */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Avatar email={session.user.email || ''} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-100 truncate">
              {session.user.name || 'User'}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {session.user.email}
            </p>
            <p className="text-xs text-teal-400">
              {session.user.isAdmin ? 'Admin' : 'Team Member'}
            </p>
          </div>
          <Check className="w-4 h-4 text-teal-400 flex-shrink-0" />
        </div>
      </div>

      {/* Actions */}
      <div className="p-2">
        <button
          onClick={handleAddAccount}
          disabled={isLoading}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-gray-100 hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
        
        <button
          onClick={handleSwitchAccount}
          disabled={isLoading}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-300 hover:text-gray-100 hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
        >
          <UserCog className="w-4 h-4" />
          Switch Account
        </button>
        
        <hr className="my-2 border-gray-700" />
        
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          {isSigningOut ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    </motion.div>
  )
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
            <div className="mb-8">
              <Logo size="sm" />
            </div>

            {/* Navigation items in collapsed state */}
            <nav className="flex-1 flex flex-col gap-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`p-3 rounded-lg transition-all duration-200 ${
                    pathname === item.href
                      ? "bg-teal-500/20 text-teal-300"
                      : "text-gray-400 hover:text-gray-100 hover:bg-gray-700/50"
                  }`}
                  title={item.name}
                >
                  <item.icon className="w-5 h-5" />
                </Link>
              ))}
            </nav>

            {/* User avatar in collapsed state */}
            {session?.user && (
              <div className="mt-auto">
                <button
                  onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
                  className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
                  title={session.user.name || 'Account'}
                >
                  <Avatar email={session.user.email || ''} />
                </button>
              </div>
            )}
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
                <LogoWithText 
                  size="md" 
                  textSize="lg"
                  className="justify-start"
                />
                <p className="text-xs text-gray-400 mt-2">
                  {session?.user?.isAdmin ? 'Admin Panel' : 'Team Portal'}
                </p>
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
              {session?.user && (
                <div className="relative p-4 border-t border-gray-700">
                  <AnimatePresence>
                    {showAccountSwitcher && (
                      <AccountSwitcher onClose={() => setShowAccountSwitcher(false)} />
                    )}
                  </AnimatePresence>
                  
                  <button
                    onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700/50 transition-colors group"
                  >
                    <Avatar email={session.user.email || ''} />
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-gray-100 truncate group-hover:text-white transition-colors">
                        {session.user.name || 'User'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {session.user.isAdmin ? 'Admin' : 'Member'}
                      </p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-300 transition-colors" />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Overlay for account switcher on mobile/small screens */}
      <AnimatePresence>
        {showAccountSwitcher && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAccountSwitcher(false)}
            className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          />
        )}
      </AnimatePresence>
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