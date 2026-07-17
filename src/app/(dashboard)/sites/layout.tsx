import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Sites',
  description: 'Manage the sites your team cleans and maintains.',
}

export default function SitesLayout({ children }: { children: ReactNode }) {
  return children
}
