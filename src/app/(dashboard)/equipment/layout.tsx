import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Equipment',
  description: 'Manage equipment used in infection-prevention cleaning workflows.',
}

export default function EquipmentLayout({ children }: { children: ReactNode }) {
  return children
}
