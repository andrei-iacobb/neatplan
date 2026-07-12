import type { Metadata } from 'next'
import { type ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Demo',
}

// The /demo pages are hardcoded dark. This pre-paint script flips the theme
// class before first paint so direct loads don't flash the .light overrides
// from globals.css; SettingsProvider keeps /demo dark (and restores the user's
// theme on navigation away) via its pathname-aware theme effect.
export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var r=document.documentElement;r.classList.remove('light');r.classList.add('dark');}catch(e){}})();`,
        }}
      />
      {children}
    </>
  )
}
