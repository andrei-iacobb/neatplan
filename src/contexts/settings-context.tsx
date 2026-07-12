'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { usePathname } from 'next/navigation'

export interface SettingsState {
  theme: 'light' | 'dark' | 'system'
  notifications: {
    email: boolean
    push: boolean
    taskReminders: boolean
    scheduleUpdates: boolean
    systemAlerts: boolean
  }
  privacy: {
    profileVisibility: 'public' | 'private' | 'team'
    activityTracking: boolean
    analyticsOptIn: boolean
  }
  display: {
    sidebarCollapsed: boolean
    compactMode: boolean
    animationsEnabled: boolean
    soundEnabled: boolean
  }
  system: {
    autoSave: boolean
    sessionTimeout: number
    language: string
  }
}

const defaultSettings: SettingsState = {
  theme: 'light',
  notifications: {
    email: true,
    push: true,
    taskReminders: true,
    scheduleUpdates: true,
    systemAlerts: true
  },
  privacy: {
    profileVisibility: 'team',
    activityTracking: true,
    analyticsOptIn: false
  },
  display: {
    sidebarCollapsed: false,
    compactMode: false,
    animationsEnabled: true,
    soundEnabled: true
  },
  system: {
    autoSave: true,
    sessionTimeout: 24,
    language: 'en'
  }
}

interface SettingsContextType {
  settings: SettingsState
  updateSetting: (section: keyof SettingsState, key: string, value: any) => void
  resetSettings: () => void
  saveSettings: () => Promise<void>
  isLoading: boolean
  resolvedTheme: 'light' | 'dark'
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [settings, setSettings] = useState<SettingsState>(defaultSettings)
  const [isLoading, setIsLoading] = useState(false)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  // Load settings from API on mount, fall back to localStorage
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/user/settings')
        if (res.ok) {
          const data = await res.json()
          if (data) {
            setSettings({ ...defaultSettings, ...data })
            return
          }
        }
      } catch {
        // API unavailable, fall back to localStorage
      }
      const savedSettings = localStorage.getItem('neatplan-settings')
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings)
          setSettings({ ...defaultSettings, ...parsed })
        } catch (error) {
          console.error('Error loading settings:', error)
        }
      }
    }
    loadSettings()
  }, [])

  // Handle system theme detection and theme resolution
  useEffect(() => {
    const updateResolvedTheme = () => {
      if (settings.theme === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        setResolvedTheme(systemPrefersDark ? 'dark' : 'light')
      } else {
        setResolvedTheme(settings.theme)
      }
    }

    updateResolvedTheme()

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => updateResolvedTheme()
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [settings.theme])

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement

    // The standalone /demo pages are hardcoded dark and must not receive the
    // .light overrides from globals.css - force dark while on them.
    if (pathname === '/demo' || pathname?.startsWith('/demo/')) {
      root.classList.remove('light')
      root.classList.add('dark')
      return
    }

    if (resolvedTheme === 'light') {
      root.classList.remove('dark')
      root.classList.add('light')
    } else {
      root.classList.remove('light')
      root.classList.add('dark')
    }
  }, [resolvedTheme, pathname])

  // Apply compact mode
  useEffect(() => {
    const root = document.documentElement
    
    if (settings.display.compactMode) {
      root.classList.add('compact-mode')
    } else {
      root.classList.remove('compact-mode')
    }
  }, [settings.display.compactMode])

  // Apply animations setting
  useEffect(() => {
    const root = document.documentElement
    
    if (!settings.display.animationsEnabled) {
      root.classList.add('reduce-motion')
    } else {
      root.classList.remove('reduce-motion')
    }
  }, [settings.display.animationsEnabled])

  const updateSetting = (section: keyof SettingsState, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as any),
        [key]: value
      }
    }))
  }

  const saveSettings = async () => {
    setIsLoading(true)
    try {
      // Save to localStorage as cache
      localStorage.setItem('neatplan-settings', JSON.stringify(settings))

      // Persist to API
      await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
    } catch (error) {
      console.error('Error saving settings:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const resetSettings = () => {
    setSettings(defaultSettings)
    localStorage.removeItem('neatplan-settings')
  }

  // Auto-save when settings change (if auto-save is enabled)
  useEffect(() => {
    if (settings.system.autoSave) {
      const timeoutId = setTimeout(() => {
        localStorage.setItem('neatplan-settings', JSON.stringify(settings))
      }, 1000) // Debounce auto-save by 1 second
      
      return () => clearTimeout(timeoutId)
    }
  }, [settings])

  const value: SettingsContextType = {
    settings,
    updateSetting,
    resetSettings,
    saveSettings,
    isLoading,
    resolvedTheme
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
} 