import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Change Password',
  description: 'Update your NeatPlan account password.',
}

export default function ChangePasswordLayout({ children }: { children: ReactNode }) {
  return children
}
