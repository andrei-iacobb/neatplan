import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Schedules',
  description: 'Plan infection-prevention cleaning schedules and recurring tasks.',
}

export default function ScheduleLayout({ children }: { children: ReactNode }) {
  return children
}
