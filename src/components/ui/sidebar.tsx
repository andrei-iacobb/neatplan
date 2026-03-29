"use client"

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from "next/navigation"
import {
  Home, Calendar, Settings, DoorOpen, Upload, LogOut, User, Wrench, ClipboardCheck
} from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { useSettings } from "@/contexts/settings-context"

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Rooms", href: "/rooms", icon: DoorOpen },
  { name: "Equipment", href: "/equipment", icon: Wrench },
  { name: "Schedule", href: "/schedule", icon: Calendar },
  { name: "Audit Log", href: "/audit", icon: ClipboardCheck },
  { name: "Users", href: "/users", icon: User },
  { name: "Upload", href: "/upload", icon: Upload },
  { name: "Settings", href: "/settings", icon: Settings },
]

const isActiveRoute = (pathname: string, href: string) => {
  if (href === "/") return pathname === "/"
  return pathname.startsWith(href)
}

const ease: [number, number, number, number] = [0.25, 0.1, 0.25, 1]

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()
  const { resolvedTheme } = useSettings()
  const isDark = resolvedTheme === 'dark'
  const expandRef = useRef<NodeJS.Timeout | null>(null)
  const collapseRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    if (collapseRef.current) { clearTimeout(collapseRef.current); collapseRef.current = null }
    expandRef.current = setTimeout(() => setIsExpanded(true), 60)
  }

  const handleMouseLeave = () => {
    if (expandRef.current) { clearTimeout(expandRef.current); expandRef.current = null }
    collapseRef.current = setTimeout(() => setIsExpanded(false), 120)
  }

  useEffect(() => {
    return () => {
      if (expandRef.current) clearTimeout(expandRef.current)
      if (collapseRef.current) clearTimeout(collapseRef.current)
    }
  }, [])

  const t = {
    bg: isDark ? 'rgba(14, 14, 20, 0.85)' : 'rgba(255, 255, 255, 0.92)',
    border: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    title: isDark ? 'rgba(232,232,237,0.95)' : 'rgba(17,17,27,0.9)',
    navDefault: isDark ? 'rgba(139,139,158,0.9)' : 'rgba(100,100,120,0.8)',
    navHover: isDark ? 'rgba(232,232,237,0.85)' : 'rgba(17,17,27,0.85)',
    navHoverBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    activeBg: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.08)',
    divider: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    signoutDefault: isDark ? 'rgba(139,139,158,0.7)' : 'rgba(100,100,120,0.6)',
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: isExpanded ? 220 : 60 }}
      transition={{ duration: 0.25, ease }}
      className="fixed left-0 top-0 h-full z-40 overflow-hidden flex flex-col transition-colors duration-300"
      style={{ background: t.bg, backdropFilter: 'blur(20px)', borderRight: `1px solid ${t.border}` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Logo */}
      <div className="h-[60px] flex items-center px-[14px] flex-shrink-0">
        <div className="flex items-center min-w-0">
          <motion.div
            animate={{ scale: isExpanded ? 1.05 : 0.85 }}
            transition={{ duration: 0.25, ease }}
            className="flex-shrink-0"
          >
            <Logo size="sm" />
          </motion.div>
          <motion.span
            animate={{ opacity: isExpanded ? 1 : 0, x: isExpanded ? 0 : -6 }}
            transition={{ duration: 0.2, ease, delay: isExpanded ? 0.08 : 0 }}
            className="ml-2.5 font-bold text-[15px] tracking-tight whitespace-nowrap"
            style={{ color: t.title }}
          >
            NeatPlan
          </motion.span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 px-[10px] pt-1">
        {navigation.map((item) => {
          const active = isActiveRoute(pathname, item.href)
          return (
            <Link
              key={item.name}
              href={item.href}
              className="relative flex items-center rounded-lg px-[10px] py-[9px] transition-colors duration-150 group"
              style={{
                color: active ? 'rgb(16, 185, 129)' : t.navDefault,
                background: active ? t.activeBg : 'transparent',
              }}
              title={!isExpanded ? item.name : undefined}
              onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = t.navHoverBg; e.currentTarget.style.color = t.navHover }}}
              onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.navDefault }}}
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-[6px] bottom-[6px] w-[3px] rounded-full"
                  style={{ background: 'rgb(16, 185, 129)' }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                <item.icon className="w-[18px] h-[18px]" strokeWidth={active ? 2.2 : 1.8} />
              </div>
              <motion.span
                animate={{ opacity: isExpanded ? 1 : 0, x: isExpanded ? 0 : -6 }}
                transition={{ duration: 0.2, ease, delay: isExpanded ? 0.06 : 0 }}
                className="ml-3 text-[13px] font-medium whitespace-nowrap"
              >
                {item.name}
              </motion.span>
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      {session?.user && (
        <div className="px-[10px] pb-4 flex-shrink-0">
          <div className="mb-2 border-t" style={{ borderColor: t.divider }} />
          <button
            onClick={() => signOut({ callbackUrl: '/auth' })}
            className="w-full flex items-center rounded-lg px-[10px] py-[9px] transition-colors duration-150"
            style={{ color: t.signoutDefault }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgb(239, 68, 68)'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = t.signoutDefault; e.currentTarget.style.background = 'transparent' }}
            title={!isExpanded ? "Sign Out" : undefined}
          >
            <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
              <LogOut className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </div>
            <motion.span
              animate={{ opacity: isExpanded ? 1 : 0, x: isExpanded ? 0 : -6 }}
              transition={{ duration: 0.2, ease, delay: isExpanded ? 0.08 : 0 }}
              className="ml-3 text-[13px] font-medium whitespace-nowrap"
            >
              Sign Out
            </motion.span>
          </button>
        </div>
      )}
    </motion.aside>
  )
}
