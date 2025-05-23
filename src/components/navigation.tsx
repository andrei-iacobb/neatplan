import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Building2 } from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Rooms', href: '/rooms', icon: Building2 }
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 px-4">
      {navigation.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.name}
            href={item.href}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded transition-colors
              ${isActive
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                : 'text-gray-400 hover:bg-teal-500/10 hover:text-teal-300'
              } border
            `}
          >
            <item.icon className="w-4 h-4" />
            <span>{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )
} 