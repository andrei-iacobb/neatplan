"use client"

import { useSettings } from "@/contexts/settings-context"

export function WaveBackground() {
  const { resolvedTheme } = useSettings()
  const isDark = resolvedTheme === 'dark'

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none transition-colors duration-300" style={{ background: 'rgb(var(--background))' }}>
      {/* Subtle accent glow */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          background: isDark
            ? `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16, 185, 129, 0.04) 0%, transparent 50%),
               radial-gradient(ellipse 60% 40% at 80% 100%, rgba(99, 102, 241, 0.03) 0%, transparent 50%)`
            : `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16, 185, 129, 0.06) 0%, transparent 50%),
               radial-gradient(ellipse 60% 40% at 80% 100%, rgba(99, 102, 241, 0.04) 0%, transparent 50%)`,
        }}
      />

      {/* Dot grid */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: isDark ? 0.35 : 0.25,
          backgroundImage: isDark
            ? `radial-gradient(circle at center, rgba(255,255,255,0.15) 1px, transparent 1px)`
            : `radial-gradient(circle at center, rgba(0,0,0,0.08) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: isDark ? 1 : 0.5,
          background: `radial-gradient(ellipse at 50% 50%, transparent 40%, ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.03)'} 100%)`
        }}
      />
    </div>
  )
}
