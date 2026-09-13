import type { Metadata } from 'next'
import './print.css'

export const metadata: Metadata = {
  // Browsers use the document title as the default PDF filename and as the
  // printed header, so it is worth setting properly.
  title: 'Print',
  robots: { index: false, follow: false },
}

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return children
}
