"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const { data: session } = useSession()

  useEffect(() => {
    let timeout: NodeJS.Timeout
    if (isHovering) {
      timeout = setTimeout(() => setIsExpanded(true), 200)
    } else {
      timeout = setTimeout(() => setIsExpanded(false), 200)
    }
    return () => clearTimeout(timeout)
  }, [isHovering])

  return (
    <motion.div
      className="fixed left-0 top-0 h-full z-50 flex flex-col"
      animate={{ width: isExpanded ? '240px' : '48px' }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Background */}
      <motion.div
        className="absolute inset-0 bg-black/10 backdrop-blur-md border-r border-white/5"
        initial={false}
        animate={{
          opacity: isExpanded ? 1 : 0.7,
        }}
      />

      {/* Vertical lines */}
      <div className="absolute left-[23px] top-0 h-[40%] w-px bg-gradient-to-b from-transparent via-teal-500/20 to-transparent" />
      <div className="absolute left-[23px] bottom-0 h-[40%] w-px bg-gradient-to-b from-transparent via-teal-500/20 to-transparent" />

      {/* Menu button - centered vertically */}
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
                  width: isExpanded ? "100%" : "50%",
                  boxShadow: isExpanded ? "0 0 4px #2dd4bf" : "none"
                }}
              />
              <motion.div
                className="h-px bg-teal-400/70"
                animate={{ 
                  width: isExpanded ? "100%" : "75%",
                  boxShadow: isExpanded ? "0 0 4px #2dd4bf" : "none"
                }}
              />
              <motion.div
                className="h-px bg-teal-400/70"
                animate={{ 
                  width: isExpanded ? "100%" : "25%",
                  boxShadow: isExpanded ? "0 0 4px #2dd4bf" : "none"
                }}
              />
            </motion.div>
          </button>
        </div>
      </div>

      {/* Navigation - adjusted to not overlap with centered button */}
      <div className="relative flex-1 pt-[60%]">
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute left-[60px] right-4"
            >
              <nav className="space-y-1">
                <NavLink href="/dashboard">Dashboard</NavLink>
                <NavLink href="/rooms">Rooms</NavLink>
                <NavLink href="/cleaning">Cleaning</NavLink>
                <NavLink href="/settings">Settings</NavLink>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User section */}
      <div className="relative p-3">
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute left-[60px] bottom-3 right-4"
            >
              <div className="px-2 py-2 rounded-md bg-white/5 border border-white/10">
                <p className="text-sm text-gray-400 truncate">
                  {session?.user?.name || session?.user?.email}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link 
      href={href} 
      className="block px-3 py-2 text-sm text-gray-300 hover:text-teal-300 hover:bg-white/5 rounded-md transition-colors"
    >
      {children}
    </Link>
  )
} 