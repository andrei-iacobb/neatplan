"use client"

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from "next/navigation"
import { 
  Home, Calendar, Settings, DoorOpen, Upload, LogOut, User, ChevronDown, 
  Crown, UserCheck, Brush, UserCog, Check, Wrench,
  Zap, Star, Heart, Sparkles, Coffee, Gamepad2, Music, 
  Camera, Palette, Rocket, Shield, Trophy, Flame, Diamond,
  Gem, Wand2, Target, Compass, Lightbulb, Flower, Headphones,
  Fingerprint, Eye, Brain, Atom, Codesandbox, Hexagon
} from "lucide-react"
import { Logo } from "@/components/ui/logo"

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Rooms", href: "/rooms", icon: DoorOpen },
  { name: "Equipment", href: "/equipment", icon: Wrench },
  { name: "Schedule", href: "/schedule", icon: Calendar },
  { name: "Users", href: "/users", icon: User },
  { name: "Upload", href: "/upload", icon: Upload },
  { name: "Settings", href: "/settings", icon: Settings },
]

// Helper function to check if a path is active
const isActiveRoute = (pathname: string, href: string) => {
  if (href === "/") {
    return pathname === "/"
  }
  return pathname.startsWith(href)
}

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()
  const expandTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current)
      collapseTimeoutRef.current = null
    }
    
    expandTimeoutRef.current = setTimeout(() => {
      setIsExpanded(true)
    }, 50)
  }

  const handleMouseLeave = () => {
    if (expandTimeoutRef.current) {
      clearTimeout(expandTimeoutRef.current)
      expandTimeoutRef.current = null
    }
    
    collapseTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false)
    }, 150)
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth' })
  }

  useEffect(() => {
    return () => {
      if (expandTimeoutRef.current) clearTimeout(expandTimeoutRef.current)
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current)
    }
  }, [])

  return (
    <>
      <motion.div
        initial={false}
        animate={{ 
          width: isExpanded ? 280 : 60,
        }}
        transition={{ 
          duration: 0.4, 
          ease: [0.25, 0.1, 0.25, 1],
        }}
        className="fixed left-0 top-0 h-full bg-gray-800/50 backdrop-blur-md border-r border-gray-700 z-40 overflow-hidden"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="h-full flex flex-col justify-between py-6">
          <div className="w-full">
                                    {/* Logo section - always visible with smooth scaling */}
            <div className="h-16 flex items-center mb-8 px-4">
              <div className="flex items-center min-w-0">
                {/* Logo - always visible, scales smoothly, stays in same position */}
                <motion.div
                  animate={{ 
                    scale: isExpanded ? 1.15 : 0.9,
                  }}
                  transition={{ 
                    duration: 0.4, 
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                  className="flex-shrink-0"
                >
                  <Logo size="sm" />
                </motion.div>
                  
                {/* CleanTrack text - appears when expanded */}
                <motion.div
                  animate={{ 
                    opacity: isExpanded ? 1 : 0,
                    x: isExpanded ? 0 : -10,
                  }}
                  transition={{ 
                    duration: 0.4,
                    ease: [0.25, 0.1, 0.25, 1],
                    delay: isExpanded ? 0.15 : 0,
                  }}
                  className="ml-3 font-bold text-gray-100 text-xl whitespace-nowrap"
                >
                  CleanTrack
                </motion.div>
              </div>
            </div>
            
            <nav className="flex flex-col gap-1">
              {navigation.map((item, index) => (
                <NavLink 
                  key={item.name} 
                  href={item.href} 
                  isActive={isActiveRoute(pathname, item.href)} 
                  icon={<item.icon className="w-5 h-5" />}
                  isExpanded={isExpanded}
                  index={index}
                >
                  {item.name}
                </NavLink>
              ))}
            </nav>
          </div>

          {session?.user && (
            <div className="w-full">
              <div className="mx-3">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center rounded-lg text-red-400 hover:bg-red-500/20 transition-colors duration-200 px-3 py-2.5"
                  title={!isExpanded ? "Sign Out" : undefined}
                >
                  {/* Fixed icon position */}
                  <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                    <LogOut className="w-5 h-5" />
                  </div>
                  
                  {/* Sign out text */}
                  <motion.div
                    animate={{ 
                      opacity: isExpanded ? 1 : 0,
                      x: isExpanded ? 0 : -10,
                    }}
                    transition={{ 
                      duration: 0.4,
                      ease: [0.25, 0.1, 0.25, 1],
                      delay: isExpanded ? 0.2 : 0,
                    }}
                    className="ml-3 font-medium whitespace-nowrap"
                  >
                    Sign Out
                  </motion.div>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}

function NavLink({ 
  href, 
  children, 
  isActive, 
  icon,
  isExpanded,
  index
}: { 
  href: string
  children: React.ReactNode
  isActive: boolean
  icon: React.ReactNode
  isExpanded: boolean
  index: number
}) {
  return (
    <div className="mx-3">
      <Link
        href={href}
        className={`flex items-center rounded-lg transition-colors duration-200 px-3 py-2.5 ${
          isActive
            ? "bg-blue-500/20 text-blue-300 shadow-lg shadow-blue-500/10"
            : "text-gray-400 hover:text-gray-100 hover:bg-gray-700/50"
        }`}
        title={!isExpanded ? children as string : undefined}
      >
        {/* Fixed icon position - never moves */}
        <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
          {icon}
        </div>
        
        {/* Label text - smoothly appears/disappears */}
        <motion.div
          animate={{ 
            opacity: isExpanded ? 1 : 0,
            x: isExpanded ? 0 : -10,
          }}
          transition={{ 
            duration: 0.4,
            ease: [0.25, 0.1, 0.25, 1],
            delay: isExpanded ? 0.1 + (index * 0.02) : 0,
          }}
          className="ml-3 whitespace-nowrap"
        >
          {children}
        </motion.div>
      </Link>
    </div>
  )
} 