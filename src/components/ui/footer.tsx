"use client"

import { useSettings } from "@/contexts/settings-context"

export function Footer() {
  const currentYear = process.env.NEXT_PUBLIC_COPYRIGHT_YEAR
  const { resolvedTheme } = useSettings()
  const isDark = resolvedTheme === 'dark'

  return (
    <footer className="w-full shrink-0 transition-colors duration-300"
      style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}` }}>
      <div className="px-6 py-2.5">
        <p className="text-[11px] text-center" style={{ color: isDark ? 'rgba(139,139,158,0.6)' : 'rgba(140,140,160,0.6)' }}>
          &copy; {currentYear} NeatPlan. All rights reserved. Developed by{' '}
          <a
            href="https://andrei.iacob.uk/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors duration-150"
            style={{ color: isDark ? 'rgba(139,139,158,0.8)' : 'rgba(100,100,120,0.8)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(16,185,129)'}
            onMouseLeave={(e) => e.currentTarget.style.color = isDark ? 'rgba(139,139,158,0.8)' : 'rgba(100,100,120,0.8)'}
          >
            Andrei Iacob
          </a>
        </p>
      </div>
    </footer>
  )
}
