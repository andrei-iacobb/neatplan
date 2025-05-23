"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from "next/navigation"
import { Home, Calendar, Settings, DoorOpen } from "lucide-react"

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Rooms", href: "/rooms", icon: DoorOpen },
  { name: "Schedule", href: "/schedule", icon: Calendar },
  { name: "Settings", href: "/settings", icon: Settings },
]

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false)
  const { data: session } = useSession()
  const pathname = usePathname()

  return (
    <motion.div
      className="fixed left-0 top-0 h-full z-50"
      initial={{ width: '60px' }}
      animate={{ width: isExpanded ? '240px' : '60px' }}
      transition={{ type: "tween", duration: 0.2 }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <motion.div
        className="absolute inset-0 bg-black/10 backdrop-blur-md border-r border-white/5"
        initial={{ opacity: 0.3 }}
        animate={{ opacity: isExpanded ? 1 : 0.3 }}
        transition={{ duration: 0.2 }}
      />

      {/* Menu button - centered vertically */}
      {!isExpanded && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full">
          <div className="relative z-10 m-3">
            <button
              className="relative p-1.5 rounded-md hover:bg-white/5 transition-colors group w-fit"
            >
              <motion.div 
                className="w-4 h-3 flex flex-col justify-between"
                whileHover={{
                  filter: "brightness(1.2)",
                  transition: { duration: 0.2 }
                }}
              >
                <motion.div
                  className="h-px bg-teal-400/70"
                  animate={{ 
                    width: "50%",
                    boxShadow: "0 0 4px #2dd4bf"
                  }}
                />
                <motion.div
                  className="h-px bg-teal-400/70"
                  animate={{ 
                    width: "75%",
                    boxShadow: "0 0 4px #2dd4bf"
                  }}
                />
                <motion.div
                  className="h-px bg-teal-400/70"
                  animate={{ 
                    width: "25%",
                    boxShadow: "0 0 4px #2dd4bf"
                  }}
                />
              </motion.div>
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="relative h-full flex flex-col"
          >
            <nav className="flex-1 p-4 space-y-2">
              {navigation.map((item) => (
                <NavLink 
                  key={item.name} 
                  href={item.href}
                  isActive={pathname === item.href}
                >
                  <item.icon className="w-4 h-4 mr-3" />
                  {item.name}
                </NavLink>
              ))}
            </nav>

            {session?.user && (
              <div className="p-4 border-t border-white/5">
                <div className="px-3 py-2 rounded-md bg-white/5">
                  <p className="text-sm text-gray-400 truncate">
                    {session.user.name || session.user.email}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function NavLink({ href, children, isActive }: { href: string; children: React.ReactNode; isActive: boolean }) {
  return (
    <Link 
      href={href} 
      className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
        isActive 
          ? "text-teal-300 bg-teal-500/10" 
          : "text-gray-300 hover:text-teal-300 hover:bg-white/5"
      }`}
    >
      {children}
    </Link>
  )
} 