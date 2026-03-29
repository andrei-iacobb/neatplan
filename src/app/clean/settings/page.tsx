"use client"

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { User, Lock, Palette, ArrowLeft, Sun, Moon, Monitor, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSettings } from '@/contexts/settings-context'

export default function CleanerSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { settings, updateSetting } = useSettings()

  // Profile state
  const [name, setName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Security state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [securitySaving, setSecuritySaving] = useState(false)
  const [securityMessage, setSecurityMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth')
      return
    }

    if (status === 'authenticated' && session?.user?.isAdmin) {
      router.replace('/settings') // Redirect admins to admin settings
      return
    }
  }, [status, router, session])

  useEffect(() => {
    if (session?.user?.name) {
      setName(session.user.name)
    }
  }, [session])

  const handleProfileSave = async () => {
    setProfileSaving(true)
    setProfileMessage(null)
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update profile')
      }
      setProfileMessage({ type: 'success', text: 'Profile updated successfully' })
    } catch (error: any) {
      setProfileMessage({ type: 'error', text: error.message || 'Failed to update profile' })
    } finally {
      setProfileSaving(false)
    }
  }

  const handleChangePassword = async () => {
    setSecurityMessage(null)

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setSecurityMessage({ type: 'error', text: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character.' })
      return
    }

    if (newPassword !== confirmPassword) {
      setSecurityMessage({ type: 'error', text: 'New passwords do not match' })
      return
    }

    setSecuritySaving(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to change password')
      }
      setSecurityMessage({ type: 'success', text: 'Password changed successfully' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      setSecurityMessage({ type: 'error', text: error.message || 'Failed to change password' })
    } finally {
      setSecuritySaving(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
      </div>
    )
  }

  const themeOptions: { value: 'light' | 'dark' | 'system'; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  return (
    <div className="min-h-screen text-gray-300">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <Button
            variant="ghost"
            onClick={() => router.push('/clean')}
            className="flex items-center gap-2 text-gray-400 hover:text-gray-100 hover:bg-gray-700/50 px-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-gray-400">Manage your preferences and account settings</p>
        </motion.div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Profile Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-100">Profile</h3>
                <p className="text-sm text-gray-400">Update your personal information</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="bg-gray-700/50 border-gray-600 text-gray-100 placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                <Input
                  value={session?.user?.email || ''}
                  readOnly
                  className="bg-gray-700/30 border-gray-600 text-gray-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                <Input
                  value="Cleaner"
                  readOnly
                  className="bg-gray-700/30 border-gray-600 text-gray-400 cursor-not-allowed"
                />
              </div>

              {profileMessage && (
                <div className={`flex items-center gap-2 text-sm ${profileMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {profileMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {profileMessage.text}
                </div>
              )}

              <Button
                onClick={handleProfileSave}
                disabled={profileSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {profileSaving ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </motion.div>

          {/* Security Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Lock className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-100">Security</h3>
                <p className="text-sm text-gray-400">Change your password</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Current Password</label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="bg-gray-700/50 border-gray-600 text-gray-100 placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 8 characters)"
                  className="bg-gray-700/50 border-gray-600 text-gray-100 placeholder-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Confirm New Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="bg-gray-700/50 border-gray-600 text-gray-100 placeholder-gray-500"
                />
              </div>

              {securityMessage && (
                <div className={`flex items-center gap-2 text-sm ${securityMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                  {securityMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {securityMessage.text}
                </div>
              )}

              <Button
                onClick={handleChangePassword}
                disabled={securitySaving || !currentPassword || !newPassword || !confirmPassword}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {securitySaving ? 'Changing...' : 'Change Password'}
              </Button>
            </div>
          </motion.div>

          {/* Appearance Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Palette className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-100">Appearance</h3>
                <p className="text-sm text-gray-400">Customize your interface theme</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Theme</label>
              <div className="flex gap-3">
                {themeOptions.map((option) => {
                  const Icon = option.icon
                  const isActive = settings.theme === option.value
                  return (
                    <button
                      key={option.value}
                      onClick={() => updateSetting('theme' as keyof typeof settings, 'theme', option.value)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors ${
                        isActive
                          ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                          : 'bg-gray-700/30 border-gray-600 text-gray-400 hover:bg-gray-700/50 hover:text-gray-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
