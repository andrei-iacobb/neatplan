"use client"

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { User, Lock, Palette, ArrowLeft, Sun, Moon, Monitor, Check, AlertCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useSettings } from '@/contexts/settings-context'
import { useThemeColors } from '@/hooks/useThemeColors'
import { PageLoading } from '@/components/ui/loading'

export default function CleanerSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { settings, setTheme } = useSettings()
  const tc = useThemeColors()

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
      <div className="max-w-[1100px] mx-auto relative z-10 pb-8">
        <PageLoading cards={3} label="Loading settings" />
      </div>
    )
  }

  const themeOptions: { value: 'light' | 'dark' | 'system'; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  const inputStyle = { background: tc.inputBg, border: `1px solid ${tc.inputBorder}`, color: tc.inputText }
  const readOnlyStyle = { background: tc.emptyBg, border: `1px solid ${tc.inputBorder}`, color: tc.textMuted }
  const cardStyle = { background: tc.cardBg, border: `1px solid ${tc.cardBorder}`, boxShadow: tc.shadow }

  return (
    <div className="min-h-screen" style={{ color: tc.textSecondary }}>
      <div className="max-w-4xl mx-auto px-4">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6"
        >
          <button
            onClick={() => router.push('/clean')}
            className="flex items-center gap-2 text-[13px] font-medium transition-colors px-0"
            style={{ color: tc.textMuted }}
            onMouseEnter={(e) => { e.currentTarget.style.color = tc.textPrimary }}
            onMouseLeave={(e) => { e.currentTarget.style.color = tc.textMuted }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold mb-2" style={{ color: tc.textPrimary }}>Settings</h1>
          <p style={{ color: tc.textMuted }}>Manage your preferences and account settings</p>
        </motion.div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Profile Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl p-6"
            style={cardStyle}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)' }}>
                <User className="w-5 h-5" style={{ color: tc.accentGreen }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: tc.textPrimary }}>Profile</h3>
                <p className="text-sm" style={{ color: tc.textMuted }}>Update your personal information</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: tc.textSecondary }}>Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: tc.textSecondary }}>Email</label>
                <Input
                  value={session?.user?.email || ''}
                  readOnly
                  className="cursor-not-allowed"
                  style={readOnlyStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: tc.textSecondary }}>Role</label>
                <Input
                  value="Cleaner"
                  readOnly
                  className="cursor-not-allowed"
                  style={readOnlyStyle}
                />
              </div>

              {profileMessage && (
                <div className="flex items-center gap-2 text-sm" style={{ color: profileMessage.type === 'success' ? tc.statusCompleted.text : tc.statusOverdue.text }}>
                  {profileMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {profileMessage.text}
                </div>
              )}

              <button
                onClick={handleProfileSave}
                disabled={profileSaving}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50"
                style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: `1px solid ${tc.btnPrimaryBorder}` }}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = tc.btnPrimaryHoverBg }}
                onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnPrimaryBg }}
              >
                {profileSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </motion.div>

          {/* Security Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl p-6"
            style={cardStyle}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: tc.statusOverdue.bg }}>
                <Lock className="w-5 h-5" style={{ color: tc.statusOverdue.text }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: tc.textPrimary }}>Security</h3>
                <p className="text-sm" style={{ color: tc.textMuted }}>Change your password</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: tc.textSecondary }}>Current Password</label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: tc.textSecondary }}>New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 8 characters)"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: tc.textSecondary }}>Confirm New Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  style={inputStyle}
                />
              </div>

              {securityMessage && (
                <div className="flex items-center gap-2 text-sm" style={{ color: securityMessage.type === 'success' ? tc.statusCompleted.text : tc.statusOverdue.text }}>
                  {securityMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {securityMessage.text}
                </div>
              )}

              <button
                onClick={handleChangePassword}
                disabled={securitySaving || !currentPassword || !newPassword || !confirmPassword}
                className="px-4 py-2 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: tc.btnDangerBg, color: tc.btnDangerText, border: `1px solid ${tc.btnDangerBorder}` }}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = tc.btnDangerHoverBg }}
                onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnDangerBg }}
              >
                {securitySaving ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </motion.div>

          {/* Appearance Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl p-6"
            style={cardStyle}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
                <Palette className="w-5 h-5" style={{ color: tc.accentIndigo }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: tc.textPrimary }}>Appearance</h3>
                <p className="text-sm" style={{ color: tc.textMuted }}>Customize your interface theme</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: tc.textSecondary }}>Theme</label>
              <div className="flex gap-3">
                {themeOptions.map((option) => {
                  const Icon = option.icon
                  const isActive = settings.theme === option.value
                  return (
                    <button
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors"
                      style={isActive
                        ? { background: tc.tabActiveBg, color: tc.tabActiveText, border: `1px solid ${tc.tabActiveBorder}` }
                        : { background: tc.tabInactiveBg, color: tc.tabInactiveText, border: '1px solid transparent' }}
                      onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = tc.tabInactiveHoverBg; e.currentTarget.style.color = tc.tabInactiveHoverText } }}
                      onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = tc.tabInactiveBg; e.currentTarget.style.color = tc.tabInactiveText } }}
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
