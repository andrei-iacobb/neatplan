import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to manage infection-prevention cleaning tasks and compliance.',
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return children
}
