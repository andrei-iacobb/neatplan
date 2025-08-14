import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { apiRequest } from '@/lib/url-utils'

interface StoredSession {
  email: string
  name: string
  isAdmin: boolean
  token: string
  lastUsed: number
}

interface SessionUser {
  email: string
  name?: string | null
  isAdmin: boolean
}

const STORAGE_KEY = 'neatplan_multi_sessions'
const MAX_SESSIONS = 5

export function useMultiUser() {
  const { data: currentSession, update: updateSession } = useSession()
  const [availableSessions, setAvailableSessions] = useState<StoredSession[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load stored sessions on mount
  useEffect(() => {
    loadStoredSessions()
  }, [])

  // Store current session when it changes
  useEffect(() => {
    if (currentSession?.user) {
      storeCurrentSession(currentSession.user)
    }
  }, [currentSession])

  const loadStoredSessions = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const sessions: StoredSession[] = JSON.parse(stored)
        // Filter out expired sessions (older than 30 days)
        const validSessions = sessions.filter(
          session => Date.now() - session.lastUsed < 30 * 24 * 60 * 60 * 1000
        )
        setAvailableSessions(validSessions)
        
        // Clean up storage if we removed expired sessions
        if (validSessions.length !== sessions.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(validSessions))
        }
      }
    } catch (error) {
      console.error('Failed to load stored sessions:', error)
    }
  }

  const storeCurrentSession = (user: SessionUser) => {
    try {
      const sessions = [...availableSessions]
      const existingIndex = sessions.findIndex(s => s.email === user.email)
      
      const sessionData: StoredSession = {
        email: user.email,
        name: user.name || user.email,
        isAdmin: user.isAdmin || false,
        token: `session_${user.email}_${Date.now()}`, // Simplified token
        lastUsed: Date.now()
      }

      if (existingIndex >= 0) {
        // Update existing session
        sessions[existingIndex] = sessionData
      } else {
        // Add new session
        sessions.push(sessionData)
        
        // Keep only the most recent sessions
        if (sessions.length > MAX_SESSIONS) {
          sessions.sort((a, b) => b.lastUsed - a.lastUsed)
          sessions.splice(MAX_SESSIONS)
        }
      }

      setAvailableSessions(sessions)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    } catch (error) {
      console.error('Failed to store session:', error)
    }
  }

  const switchToAccount = async (email: string) => {
    setIsLoading(true)
    
    try {
      // Find the stored session
      const targetSession = availableSessions.find(s => s.email === email)
      if (!targetSession) {
        throw new Error('Session not found')
      }

      // Call the switch account API
      const response = await apiRequest('/api/auth/switch-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: targetSession.email,
          sessionToken: targetSession.token
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to switch account')
      }

      const result = await response.json()
      
      // Update the current session
      await updateSession({
        user: {
          email: result.user.email,
          name: result.user.name,
          isAdmin: result.user.isAdmin
        }
      })

      // Update the lastUsed timestamp for this session
      const updatedSessions = availableSessions.map(session =>
        session.email === email
          ? { ...session, lastUsed: Date.now() }
          : session
      )
      setAvailableSessions(updatedSessions)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions))

      return true
    } catch (error) {
      console.error('Account switch failed:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const removeSession = (email: string) => {
    const updatedSessions = availableSessions.filter(s => s.email !== email)
    setAvailableSessions(updatedSessions)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions))
  }

  const clearAllSessions = () => {
    setAvailableSessions([])
    localStorage.removeItem(STORAGE_KEY)
  }

  // Get sessions excluding the current user
  const otherSessions = availableSessions.filter(
    session => session.email !== currentSession?.user?.email
  )

  return {
    currentSession,
    availableSessions: otherSessions,
    isLoading,
    switchToAccount,
    removeSession,
    clearAllSessions
  }
} 