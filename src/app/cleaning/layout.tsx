import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'My Tasks',
  description: 'View and complete assigned infection-prevention cleaning tasks.',
}

export default function CleaningLayout({ children }: { children: ReactNode }) {
  return children
}
