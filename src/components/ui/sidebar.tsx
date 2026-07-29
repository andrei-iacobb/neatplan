"use client"

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from "next/navigation"
import {
  Home, Calendar, Settings, DoorOpen, LogOut, User, Wrench, ClipboardCheck, Menu, X, ChevronsRight, ChevronsLeft, Building2
} from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { useSettings } from "@/contexts/settings-context"
import { canAccessAllSites } from "@/lib/roles"

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Rooms", href: "/rooms", icon: DoorOpen },
  { name: "Equipment", href: "/equipment", icon: Wrench },
  { name: "Schedule", href: "/schedule", icon: Calendar },
  { name: "Audit Log", href: "/audit", icon: ClipboardCheck },
  { name: "Sites", href: "/sites", icon: Building2 },
  { name: "Users", href: "/users", icon: User },
  { name: "Settings", href: "/settings", icon: Settings },
]

const isActiveRoute = (pathname: string, href: string) => {
  if (href === "/") return pathname === "/"
  return pathname.startsWith(href)
}

const ease: [number, number, number, number] = [0.25, 0.1, 0.25, 1]

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [hasLoadedPinned, setHasLoadedPinned] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()
  const { resolvedTheme } = useSettings()
  const isDark = resolvedTheme === 'dark'
  const expandRef = useRef<NodeJS.Timeout | null>(null)
  const collapseRef = useRef<NodeJS.Timeout | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const expanded = pinned || isExpanded
  // MANAGER/CLEANER are pinned to a single site, so the multi-site "Sites"
  // page is OP/DIRECTOR-only and hidden from their navigation.
  const navItems = canAccessAllSites((session?.user as any)?.role)
    ? navigation
    : navigation.filter((item) => item.href !== '/sites')

  useEffect(() => {
    setPinned(localStorage.getItem('neatplan-sidebar-pinned') === 'true')
    setHasLoadedPinned(true)
  }, [])

  useEffect(() => {
    if (hasLoadedPinned) localStorage.setItem('neatplan-sidebar-pinned', String(pinned))
  }, [pinned, hasLoadedPinned])

  // Close the mobile drawer whenever the route changes or viewport becomes desktop-sized.
  useEffect(() => { setMobileOpen(false) }, [pathname])
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => { if (mq.matches) setMobileOpen(false) }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const handleMouseEnter = () => {
    if (collapseRef.current) { clearTimeout(collapseRef.current); collapseRef.current = null }
    expandRef.current = setTimeout(() => setIsExpanded(true), 60)
  }

  const handleMouseLeave = () => {
    if (expandRef.current) { clearTimeout(expandRef.current); expandRef.current = null }
    if (!pinned) collapseRef.current = setTimeout(() => setIsExpanded(false), 120)
  }

  const togglePinned = () => {
    setPinned((wasPinned) => {
      // Always collapse on unpin: touch taps fire compatibility mouseenter
      // (which schedules the hover-expand timer) with no matching mouseleave,
      // so both the flag and the pending timer must be cleared or the sidebar
      // re-latches open on tablets. Mouse users just re-hover to expand.
      if (wasPinned) {
        if (expandRef.current) { clearTimeout(expandRef.current); expandRef.current = null }
        setIsExpanded(false)
      }
      return !wasPinned
    })
  }

  useEffect(() => {
    return () => {
      if (expandRef.current) clearTimeout(expandRef.current)
      if (collapseRef.current) clearTimeout(collapseRef.current)
    }
  }, [])

  const t = {
    /*
     * Chrome sits below content on the ramp - the sidebar is the darkest
     * surface, not the brightest. A white sidebar over a white canvas is what
     * made the shell read as glare with no edge between frame and content.
     */
    bg: 'rgb(var(--sidebar-bg))',
    border: 'rgb(var(--sidebar-border) / var(--sidebar-border-alpha))',
    title: 'rgb(var(--text-primary))',
    navDefault: isDark ? 'rgba(139,139,158,0.9)' : 'rgba(90,90,110,0.95)',
    navHover: isDark ? 'rgba(232,232,237,0.85)' : 'rgba(17,17,27,0.85)',
    navHoverBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    activeBg: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.08)',
    divider: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    signoutDefault: isDark ? 'rgba(139,139,158,0.7)' : 'rgba(100,100,120,0.6)',
  }

  return (
    <>
    <motion.aside
      initial={false}
      animate={{ width: expanded ? 220 : 60 }}
      transition={{ duration: 0.25, ease }}
      className="hidden md:flex fixed left-0 top-0 h-full z-40 overflow-hidden flex-col transition-colors duration-300"
      style={{ background: t.bg, backdropFilter: 'blur(20px)', borderRight: `1px solid ${t.border}` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Logo */}
      <div className="h-[60px] flex items-center px-[14px] flex-shrink-0">
        <div className="flex items-center min-w-0">
          <motion.div
            animate={{ scale: expanded ? 1.05 : 0.85 }}
            transition={{ duration: 0.25, ease }}
            className="flex-shrink-0"
          >
            <Logo size="sm" />
          </motion.div>
          <motion.span
            animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -6 }}
            transition={{ duration: 0.2, ease, delay: expanded ? 0.08 : 0 }}
            className="ml-2.5 font-bold text-[15px] tracking-tight whitespace-nowrap"
            style={{ color: t.title }}
          >
            NeatPlan
          </motion.span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 px-[10px] pt-1">
        <button
          onClick={togglePinned}
          aria-label={pinned ? 'Collapse navigation' : 'Expand navigation'}
          className="flex items-center rounded-lg px-[10px] py-[9px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-95"
          style={{ color: t.navDefault }}
          onMouseEnter={(e) => { e.currentTarget.style.background = t.navHoverBg; e.currentTarget.style.color = t.navHover }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.navDefault }}
        >
          <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
            {pinned ? <ChevronsLeft className="w-[18px] h-[18px]" /> : <ChevronsRight className="w-[18px] h-[18px]" />}
          </div>
        </button>
        {navItems.map((item) => {
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
              title={!expanded ? item.name : undefined}
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
                animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -6 }}
                transition={{ duration: 0.2, ease, delay: expanded ? 0.06 : 0 }}
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
            onClick={() => { signOut({ redirect: false }).then(() => { window.location.href = '/auth' }) }}
            className="w-full flex items-center rounded-lg px-[10px] py-[9px] transition-colors duration-150"
            style={{ color: t.signoutDefault }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgb(239, 68, 68)'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = t.signoutDefault; e.currentTarget.style.background = 'transparent' }}
            title={!expanded ? "Sign Out" : undefined}
          >
            <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
              <LogOut className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </div>
            <motion.span
              animate={{ opacity: expanded ? 1 : 0, x: expanded ? 0 : -6 }}
              transition={{ duration: 0.2, ease, delay: expanded ? 0.08 : 0 }}
              className="ml-3 text-[13px] font-medium whitespace-nowrap"
            >
              Sign Out
            </motion.span>
          </button>
        </div>
      )}
    </motion.aside>

      {/* Mobile top bar */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 h-14 z-40 flex items-center justify-between px-4"
        style={{ background: t.bg, backdropFilter: 'blur(20px)', borderBottom: `1px solid ${t.border}` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Logo size="sm" />
          <span className="font-bold text-[15px] tracking-tight truncate" style={{ color: t.title }}>NeatPlan</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-95"
          style={{ color: t.navDefault }}
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="md:hidden fixed inset-0 z-50"
              style={{ background: 'rgba(0,0,0,0.45)' }}
            />
            <motion.aside
              key="drawer"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              className="md:hidden fixed left-0 top-0 bottom-0 w-[264px] z-50 flex flex-col"
              style={{ background: t.bg, backdropFilter: 'blur(20px)', borderRight: `1px solid ${t.border}` }}
              role="dialog"
              aria-label="Navigation"
            >
              <div className="h-14 flex items-center justify-between px-4 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Logo size="sm" />
                  <span className="font-bold text-[15px] tracking-tight truncate" style={{ color: t.title }}>NeatPlan</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation menu"
                  className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:scale-95"
                  style={{ color: t.navDefault }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 flex flex-col gap-0.5 px-3 pt-2 overflow-y-auto">
                {navItems.map((item) => {
                  const active = isActiveRoute(pathname, item.href)
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-3 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                      style={{ color: active ? 'rgb(16, 185, 129)' : t.navDefault, background: active ? t.activeBg : 'transparent' }}
                    >
                      <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
              {session?.user && (
                <div className="px-3 pt-2 flex-shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                  <div className="mb-2 border-t" style={{ borderColor: t.divider }} />
                  <button
                    onClick={() => { signOut({ redirect: false }).then(() => { window.location.href = '/auth' }) }}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-3 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                    style={{ color: t.signoutDefault }}
                  >
                    <LogOut className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
                    Sign Out
                  </button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
