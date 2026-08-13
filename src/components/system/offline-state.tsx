'use client'

import { useOffline } from 'next/offline'
import { useEffect, useState } from 'react'

/**
 * Exposes Next's router-aware offline state to non-React integrations without
 * adding visible UI. Native events cover transitions before the provider's
 * lazy listener has been installed by the first navigation.
 */
export function OfflineState() {
  const routerOffline = useOffline()
  const [browserOffline, setBrowserOffline] = useState(false)

  useEffect(() => {
    const sync = () => setBrowserOffline(!navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  useEffect(() => {
    document.documentElement.toggleAttribute(
      'data-offline',
      routerOffline || browserOffline,
    )
  }, [browserOffline, routerOffline])

  return null
}
