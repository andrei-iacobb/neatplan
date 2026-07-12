import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Configure your infection-prevention cleaning workspace and preferences.',
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children
}
