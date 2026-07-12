import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Users',
  description: 'Manage the team responsible for infection-prevention cleaning.',
}

export default function UsersLayout({ children }: { children: ReactNode }) {
  return children
}
