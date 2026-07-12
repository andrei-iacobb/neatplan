import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Rooms',
  description: 'Track room cleaning status for effective infection prevention.',
}

export default function RoomsLayout({ children }: { children: ReactNode }) {
  return children
}
