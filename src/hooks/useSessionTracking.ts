import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface SessionTrackingOptions {
  updateInterval?: number // in milliseconds, default 5 minutes
  trackActivity?: boolean
}

export function useSessionTracking(options: SessionTrackingOptions = {}) {
  const { data: session } = useSession()
  const {
    updateInterval = 5 * 60 * 1000, // 5 minutes
    trackActivity = true
  } = options
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const updateSessionActivity = async () => {
    if (!session?.user) return

    try {
      await fetch('/api/session-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'update_activity',
          sessionToken: (session as any).sessionToken // From JWT token if available
        })
      })
    } catch (error) {
      console.error('Failed to update session activity:', error)
    }
  }

  const logoutSession = async () => {
    if (!session?.user) return

    try {
      await fetch('/api/session-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'logout',
          sessionToken: (session as any).sessionToken
        })
      })
    } catch (error) {
      console.error('Failed to log session logout:', error)
    }
  }

  const handleActivity = () => {
    lastActivityRef.current = Date.now()
  }

  useEffect(() => {
    if (!session?.user || !trackActivity) return

    // Set up periodic session activity updates
    intervalRef.current = setInterval(updateSessionActivity, updateInterval)

    // Track user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    
    if (trackActivity) {
      activityEvents.forEach(event => {
        document.addEventListener(event, handleActivity, true)
      })
    }

    // Handle page unload (logout tracking)
    const handleBeforeUnload = () => {
      // Use sendBeacon for better reliability during page unload
      if (navigator.sendBeacon) {
        const data = JSON.stringify({
          action: 'logout',
          sessionToken: (session as any).sessionToken
        })
        navigator.sendBeacon('/api/session-tracking', data)
      } else {
        logoutSession()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    // Initial activity update
    updateSessionActivity()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
      
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [session, updateInterval, trackActivity])

  return {
    updateSessionActivity,
    logoutSession,
    lastActivity: lastActivityRef.current
  }
} 