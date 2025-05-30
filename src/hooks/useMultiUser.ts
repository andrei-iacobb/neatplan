import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export enum UserRole {
  ADMIN = 'ADMIN',
  CLEANER = 'CLEANER'
}

export interface StoredUser {
  id: string
  email: string
  name: string
  role: UserRole
  isAdmin: boolean
  lastActive: number
}

export function useMultiUser() {
  const { data: session } = useSession()
  const [storedUsers, setStoredUsers] = useState<StoredUser[]>([])

  // Load stored users from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('cleantrack_users')
      if (stored) {
        try {
          const users = JSON.parse(stored) as StoredUser[]
          setStoredUsers(users)
        } catch (error) {
          console.error('Error loading stored users:', error)
          localStorage.removeItem('cleantrack_users')
        }
      }
    }
  }, [])

  // Update stored users when session changes
  useEffect(() => {
    if (session?.user && typeof window !== 'undefined') {
      const currentUser: StoredUser = {
        id: session.user.id || session.user.email || '',
        email: session.user.email || '',
        name: session.user.name || '',
        role: (session.user.role as UserRole) || UserRole.CLEANER,
        isAdmin: session.user.isAdmin || false,
        lastActive: Date.now()
      }

      setStoredUsers(prev => {
        // Remove any existing entry for this user
        const filtered = prev.filter(u => u.email !== currentUser.email)
        // Add current user to the front and limit to 5 accounts
        const updated = [currentUser, ...filtered].slice(0, 5)
        
        try {
          localStorage.setItem('cleantrack_users', JSON.stringify(updated))
        } catch (error) {
          console.error('Error saving users to localStorage:', error)
        }
        
        return updated
      })
    }
  }, [session])

  const removeStoredUser = (email: string) => {
    if (typeof window !== 'undefined') {
      setStoredUsers(prev => {
        const updated = prev.filter(u => u.email !== email)
        try {
          localStorage.setItem('cleantrack_users', JSON.stringify(updated))
        } catch (error) {
          console.error('Error updating localStorage:', error)
        }
        return updated
      })
    }
  }

  const switchAccount = async (email: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/switch-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      if (!response.ok) {
        throw new Error('Failed to switch account')
      }

      // Update last active for the switched user
      setStoredUsers(prev => 
        prev.map(user => 
          user.email === email 
            ? { ...user, lastActive: Date.now() }
            : user
        )
      )

      return true
    } catch (error) {
      console.error('Error switching accounts:', error)
      return false
    }
  }

  const clearAllStoredUsers = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cleantrack_users')
      setStoredUsers([])
    }
  }

  return {
    storedUsers,
    currentUser: session?.user,
    removeStoredUser,
    switchAccount,
    clearAllStoredUsers
  }
} 