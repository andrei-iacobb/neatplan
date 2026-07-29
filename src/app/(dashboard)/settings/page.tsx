'use client'

import React, { useState } from 'react'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { fadeUp, enter } from '@/lib/motion'
import {
  User,
  Palette,
  Bell,
  Shield,
  Monitor,
  Moon,
  Sun,
  Save,
  RefreshCw,
  Settings as SettingsIcon,
  Download,
  Sparkles
} from 'lucide-react'
import { useSettings } from '@/contexts/settings-context'
import { useThemeColors } from '@/hooks/useThemeColors'
import { Spinner } from '@/components/ui/loading'
import { SMTPConfiguration } from '@/components/admin/smtp-configuration'
import { TotpSettings } from '@/components/admin/totp-settings'
import { ROLE_LABELS, type Role } from '@/lib/roles'

function formatUptime(seconds?: number): string {
  if (!seconds || seconds < 0) return '-'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function Toggle({ checked, onChange, tc }: { checked: boolean; onChange: (v: boolean) => void; tc: ReturnType<typeof useThemeColors> }) {
  return (
    <div
      style={{ background: checked ? tc.toggleActiveBg : tc.toggleBg }}
      className="w-11 h-6 rounded-full relative cursor-pointer transition-colors duration-200"
      onClick={() => onChange(!checked)}
    >
      <div
        className="absolute top-[2px] h-5 w-5 bg-white rounded-full transition-all duration-200"
        style={{ left: checked ? '22px' : '2px' }}
      />
    </div>
  )
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const { settings, updateSetting, setTheme, saveSettings, isLoading, resolvedTheme } = useSettings()
  const tc = useThemeColors()
  const [activeTab, setActiveTab] = useState('profile')
  const [isSaved, setIsSaved] = useState(false)
  const [userProfile, setUserProfile] = useState({
    name: '',
    notificationEmail: '',
    currentPassword: '',
    newPassword: ''
  })
  const [profileLoading, setProfileLoading] = useState(false)
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)
  const [saveHovered, setSaveHovered] = useState(false)
  const [profileSaveHovered, setProfileSaveHovered] = useState(false)
  const [exportHovered, setExportHovered] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [hoveredTestBtn, setHoveredTestBtn] = useState<string | null>(null)
  const [sysInfo, setSysInfo] = useState<any>(null)
  // System settings (SMTP, session timeout, system info) are OP-only -
  // directors and managers never see the tab.
  const isOp = (session?.user as any)?.role === 'OP'

  // Safety net: if a non-OP ends up on the hidden System tab, bounce to Profile.
  React.useEffect(() => {
    if (activeTab === 'system' && !isOp) setActiveTab('profile')
  }, [activeTab, isOp])

  // Load live system info (OP only) when the System tab is opened
  React.useEffect(() => {
    if (activeTab !== 'system' || !isOp) return
    let active = true
    fetch('/api/admin/system-info')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (active) setSysInfo(data) })
      .catch(() => {})
    return () => { active = false }
  }, [activeTab, session])

  // Load user profile data
  React.useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/users/profile')
        if (response.ok) {
          const data = await response.json()
          setUserProfile({
            name: data.user.name || '',
            notificationEmail: data.user.notificationEmail || '',
            currentPassword: '',
            newPassword: ''
          })
        }
      } catch (error) {
        console.error('Failed to load profile:', error)
      }
    }

    if (session?.user) {
      loadProfile()
    }
  }, [session])

  const handleSaveProfile = async () => {
    setProfileLoading(true)
    try {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userProfile)
      })

      const data = await response.json()
      if (response.ok) {
        setIsSaved(true)
        setTimeout(() => setIsSaved(false), 2000)
        // Clear password fields
        setUserProfile(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: ''
        }))
      } else {
        console.error('Profile update failed:', data.error)
      }
    } catch (error) {
      console.error('Profile update error:', error)
    } finally {
      setProfileLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    try {
      await saveSettings()
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (error) {
      console.error('Error saving settings:', error)
    }
  }

  const handleSettingChange = (section: keyof typeof settings, key: string, value: any) => {
    updateSetting(section, key, value)
  }

  const handleExportData = () => {
    if (exportLoading) return

    setExportLoading(true)
    const link = document.createElement('a')
    link.href = '/api/admin/export-report'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => setExportLoading(false), 1000)
  }

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'privacy', name: 'Privacy & Security', icon: Shield },
    ...(isOp ? [{ id: 'system', name: 'System', icon: SettingsIcon }] : []),
  ]

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  return (
    <div className="max-w-[1100px] mx-auto relative z-10 pb-8">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4" style={{ color: 'rgb(16,185,129)' }} />
          <p className="text-[13px] font-medium tracking-wide uppercase" style={{ color: tc.accentLabel }}>Configuration</p>
        </div>
        <h1 className="text-[32px] font-bold tracking-tight mb-1" style={{ color: tc.textPrimary }}>Settings</h1>
        <p className="text-[15px]" style={{ color: tc.textMuted }}>Manage your preferences and account settings</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation */}
        <motion.div {...fadeUp} transition={enter()} className="w-full md:w-56 flex-shrink-0">
          <div className="rounded-xl p-3 sticky top-6" style={{ background: tc.cardBg, border: '1px solid ' + tc.cardBorder, boxShadow: tc.shadow }}>
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  onMouseEnter={() => setHoveredTab(tab.id)}
                  onMouseLeave={() => setHoveredTab(null)}
                  className="w-full flex items-center px-3 py-2 rounded-lg transition-colors text-[13px] font-medium"
                  style={
                    activeTab === tab.id
                      ? { background: tc.tabActiveBg, color: tc.tabActiveText, border: '1px solid ' + tc.tabActiveBorder }
                      : {
                          background: hoveredTab === tab.id ? tc.tabInactiveHoverBg : 'transparent',
                          color: hoveredTab === tab.id ? tc.tabInactiveHoverText : tc.tabInactiveText,
                          border: '1px solid transparent'
                        }
                  }
                >
                  <tab.icon className="w-4 h-4 mr-3" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </motion.div>

        {/* Main Content */}
        <motion.div {...fadeUp} transition={enter(1)} className="flex-1">
          <div className="rounded-xl p-6" style={{ background: tc.cardBg, border: '1px solid ' + tc.cardBorder, boxShadow: tc.shadow }}>
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <motion.div
                {...fadeUp}
                transition={enter(2)}
                className="space-y-6"
              >
                <h2 className="text-[17px] font-semibold mb-4" style={{ color: tc.textPrimary }}>Profile Settings</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[13px] font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Name
                    </label>
                    <input
                      type="text"
                      value={userProfile.name}
                      onChange={(e) => setUserProfile(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-colors"
                      style={{ background: tc.inputBg, border: '1px solid ' + tc.inputBorder, color: tc.inputText }}
                      onFocus={(e) => e.currentTarget.style.borderColor = tc.inputFocusBorder}
                      onBlur={(e) => e.currentTarget.style.borderColor = tc.inputBorder}
                      placeholder="Enter your name"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Login Email
                    </label>
                    <input
                      type="email"
                      value={session?.user?.email || ''}
                      className="w-full px-3 py-2 rounded-lg text-[13px] outline-none opacity-60"
                      style={{ background: tc.inputBg, border: '1px solid ' + tc.inputBorder, color: tc.inputText }}
                      placeholder="Enter your email"
                      disabled
                    />
                    <p className="text-[11px] mt-1" style={{ color: tc.textFaint }}>Used for login - contact admin to change</p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[13px] font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Notification Email
                    </label>
                    <input
                      type="email"
                      value={userProfile.notificationEmail}
                      onChange={(e) => setUserProfile(prev => ({ ...prev, notificationEmail: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-colors"
                      style={{ background: tc.inputBg, border: '1px solid ' + tc.inputBorder, color: tc.inputText }}
                      onFocus={(e) => e.currentTarget.style.borderColor = tc.inputFocusBorder}
                      onBlur={(e) => e.currentTarget.style.borderColor = tc.inputBorder}
                      placeholder="Email for notifications (leave empty to use login email)"
                    />
                    <p className="text-[11px] mt-1" style={{ color: tc.textFaint }}>Where you'll receive notifications. Leave blank to use your login email.</p>
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Role
                    </label>
                    <div className="w-full px-3 py-2 rounded-lg text-[13px] opacity-60" style={{ background: tc.inputBg, border: '1px solid ' + tc.inputBorder, color: tc.inputText }}>
                      {ROLE_LABELS[(session?.user as any)?.role as Role] ?? 'User'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Time Zone
                    </label>
                    <select
                      className="w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-colors"
                      style={{ background: tc.inputBg, border: '1px solid ' + tc.inputBorder, color: tc.inputText }}
                      onFocus={(e) => e.currentTarget.style.borderColor = tc.inputFocusBorder}
                      onBlur={(e) => e.currentTarget.style.borderColor = tc.inputBorder}
                    >
                      <option>UTC-8 (Pacific Time)</option>
                      <option>UTC-5 (Eastern Time)</option>
                      <option>UTC+0 (GMT)</option>
                      <option>UTC+1 (Central European Time)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4" style={{ borderTop: '1px solid ' + tc.divider }}>
                  <h3 className="text-[15px] font-medium mb-4" style={{ color: tc.textPrimary }}>Change Password</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="password"
                      value={userProfile.currentPassword}
                      onChange={(e) => setUserProfile(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="Current password"
                      className="px-3 py-2 rounded-lg text-[13px] outline-none transition-colors"
                      style={{ background: tc.inputBg, border: '1px solid ' + tc.inputBorder, color: tc.inputText }}
                      onFocus={(e) => e.currentTarget.style.borderColor = tc.inputFocusBorder}
                      onBlur={(e) => e.currentTarget.style.borderColor = tc.inputBorder}
                    />
                    <input
                      type="password"
                      value={userProfile.newPassword}
                      onChange={(e) => setUserProfile(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="New password"
                      className="px-3 py-2 rounded-lg text-[13px] outline-none transition-colors"
                      style={{ background: tc.inputBg, border: '1px solid ' + tc.inputBorder, color: tc.inputText }}
                      onFocus={(e) => e.currentTarget.style.borderColor = tc.inputFocusBorder}
                      onBlur={(e) => e.currentTarget.style.borderColor = tc.inputBorder}
                    />
                  </div>
                </div>

                {/* Save Profile Button */}
                <div className="pt-4" style={{ borderTop: '1px solid ' + tc.divider }}>
                  <button
                    onClick={handleSaveProfile}
                    disabled={profileLoading}
                    onMouseEnter={() => setProfileSaveHovered(true)}
                    onMouseLeave={() => setProfileSaveHovered(false)}
                    className="flex items-center px-6 py-2 rounded-lg text-[13px] font-medium transition-colors"
                    style={
                      isSaved
                        ? { background: tc.statusCompleted.bg, color: tc.statusCompleted.text, border: '1px solid ' + tc.statusCompleted.border }
                        : { background: profileSaveHovered ? tc.btnPrimaryHoverBg : tc.btnPrimaryBg, color: tc.btnPrimaryText, border: '1px solid ' + tc.btnPrimaryBorder }
                    }
                  >
                    {profileLoading ? (
                      <Spinner size="sm" className="mr-2" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {isSaved ? 'Profile Saved!' : 'Save Profile'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <motion.div
                {...fadeUp}
                transition={enter(2)}
                className="space-y-6"
              >
                <h2 className="text-[17px] font-semibold mb-4" style={{ color: tc.textPrimary }}>Appearance Settings</h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[13px] font-medium mb-3" style={{ color: tc.textSecondary }}>
                      Theme
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {themeOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setTheme(option.value as 'light' | 'dark' | 'system')
                          }}
                          className="flex items-center justify-center p-4 rounded-lg text-[13px] font-medium transition-colors"
                          style={
                            settings.theme === option.value
                              ? { background: tc.tabActiveBg, color: tc.tabActiveText, border: '1px solid ' + tc.tabActiveBorder }
                              : { background: tc.cardBg, color: tc.tabInactiveText, border: '1px solid ' + tc.cardBorder }
                          }
                        >
                          <option.icon className="w-5 h-5 mr-2" />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-[13px] font-medium" style={{ color: tc.textSecondary }}>Animations</label>
                        <p className="text-[11px]" style={{ color: tc.textFaint }}>Enable smooth transitions and animations</p>
                      </div>
                      <Toggle checked={settings.display.animationsEnabled} onChange={(v) => handleSettingChange('display', 'animationsEnabled', v)} tc={tc} />
                    </div>

                  </div>
                </div>
              </motion.div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <motion.div
                {...fadeUp}
                transition={enter(2)}
                className="space-y-6"
              >
                <h2 className="text-[17px] font-semibold mb-4" style={{ color: tc.textPrimary }}>Notification Settings</h2>

                <div className="space-y-4">
                  {Object.entries(settings.notifications).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div>
                        <label className="text-[13px] font-medium capitalize" style={{ color: tc.textSecondary }}>
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </label>
                        <p className="text-[11px]" style={{ color: tc.textFaint }}>
                          {key === 'email' && 'Receive notifications via email'}
                          {key === 'push' && 'Receive browser push notifications'}
                          {key === 'taskReminders' && 'Get reminders for upcoming tasks'}
                          {key === 'scheduleUpdates' && 'Notifications when schedules change'}
                          {key === 'systemAlerts' && 'Important system notifications'}
                        </p>
                      </div>
                      <Toggle checked={value} onChange={(v) => handleSettingChange('notifications', key, v)} tc={tc} />
                    </div>
                  ))}

                  {/* Test Email Section */}
                  <div className="pt-4" style={{ borderTop: '1px solid ' + tc.divider }}>
                    <h3 className="text-[15px] font-medium mb-4" style={{ color: tc.textPrimary }}>Test Email Notifications</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { type: 'task_reminder', label: 'Task Reminder' },
                        { type: 'schedule_update', label: 'Schedule Update' },
                        { type: 'system_alert', label: 'System Alert' },
                        { type: 'completion_notice', label: 'Completion Notice' }
                      ].map((test) => (
                        <button
                          key={test.type}
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/notifications/email?type=${test.type}&email=${session?.user?.email}`)
                              const result = await response.json()
                              if (result.sent) {
                              } else {
                              }
                              console.log('Test email result:', result)
                            } catch (error) {
                              console.error('Test email error:', error)
                            }
                          }}
                          onMouseEnter={() => setHoveredTestBtn(test.type)}
                          onMouseLeave={() => setHoveredTestBtn(null)}
                          className="text-[12px] font-medium px-3 py-2 rounded-lg transition-colors"
                          style={{
                            background: hoveredTestBtn === test.type ? tc.btnSecondaryHoverBg : tc.btnSecondaryBg,
                            color: tc.btnSecondaryText,
                            border: '1px solid ' + tc.btnSecondaryBorder
                          }}
                        >
                          {test.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] mt-2" style={{ color: tc.textFaint }}>
                      Click to send test emails to {userProfile.notificationEmail || session?.user?.email}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <motion.div
                {...fadeUp}
                transition={enter(2)}
                className="space-y-6"
              >
                <h2 className="text-[17px] font-semibold mb-4" style={{ color: tc.textPrimary }}>Privacy & Security</h2>

                {session?.user?.isAdmin && (
                  <div className="p-4 rounded-lg mb-6" style={{ background: tc.cardBg, border: '1px solid ' + tc.cardBorder }}>
                    <h3 className="text-[14px] font-medium mb-3" style={{ color: tc.textPrimary }}>Admin two-factor authentication</h3>
                    <TotpSettings />
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <label className="block text-[13px] font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Profile Visibility
                    </label>
                    <select
                      value={settings.privacy.profileVisibility}
                      onChange={(e) => handleSettingChange('privacy', 'profileVisibility', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-colors"
                      style={{ background: tc.inputBg, border: '1px solid ' + tc.inputBorder, color: tc.inputText }}
                      onFocus={(e) => e.currentTarget.style.borderColor = tc.inputFocusBorder}
                      onBlur={(e) => e.currentTarget.style.borderColor = tc.inputBorder}
                    >
                      <option value="public">Public</option>
                      <option value="team">Team Only</option>
                      <option value="private">Private</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[13px] font-medium" style={{ color: tc.textSecondary }}>Activity Tracking</label>
                      <p className="text-[11px]" style={{ color: tc.textFaint }}>Allow tracking of your activity for analytics</p>
                    </div>
                    <Toggle checked={settings.privacy.activityTracking} onChange={(v) => handleSettingChange('privacy', 'activityTracking', v)} tc={tc} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[13px] font-medium" style={{ color: tc.textSecondary }}>Analytics Opt-in</label>
                      <p className="text-[11px]" style={{ color: tc.textFaint }}>Help improve the app by sharing usage data</p>
                    </div>
                    <Toggle checked={settings.privacy.analyticsOptIn} onChange={(v) => handleSettingChange('privacy', 'analyticsOptIn', v)} tc={tc} />
                  </div>

                  <div className="pt-4" style={{ borderTop: '1px solid ' + tc.divider }}>
                    <h3 className="text-[15px] font-medium mb-4" style={{ color: tc.textPrimary }}>Data Management</h3>
                    <div>
                      <button
                        onClick={handleExportData}
                        disabled={exportLoading}
                        onMouseEnter={() => setExportHovered(true)}
                        onMouseLeave={() => setExportHovered(false)}
                        className="flex items-center justify-center px-4 py-2 rounded-lg text-[13px] font-medium transition-colors"
                        style={{
                          background: exportHovered ? tc.btnSecondaryHoverBg : tc.btnSecondaryBg,
                          color: tc.btnSecondaryText,
                          border: '1px solid ' + tc.btnSecondaryBorder
                        }}
                      >
                        {exportLoading ? (
                          <Spinner size="sm" className="mr-2" />
                        ) : (
                          <Download className="w-4 h-4 mr-2" />
                        )}
                        {exportLoading ? 'Exporting...' : 'Export Data'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* System Tab - OP only */}
            {activeTab === 'system' && isOp && (
              <motion.div
                {...fadeUp}
                transition={enter(2)}
                className="space-y-6"
              >
                <h2 className="text-[17px] font-semibold mb-4" style={{ color: tc.textPrimary }}>System Settings</h2>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[13px] font-medium" style={{ color: tc.textSecondary }}>Auto-save</label>
                      <p className="text-[11px]" style={{ color: tc.textFaint }}>Automatically save changes</p>
                    </div>
                    <Toggle checked={settings.system.autoSave} onChange={(v) => handleSettingChange('system', 'autoSave', v)} tc={tc} />
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Session Timeout (hours)
                    </label>
                    <select
                      value={settings.system.sessionTimeout}
                      onChange={(e) => handleSettingChange('system', 'sessionTimeout', parseInt(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-colors"
                      style={{ background: tc.inputBg, border: '1px solid ' + tc.inputBorder, color: tc.inputText }}
                      onFocus={(e) => e.currentTarget.style.borderColor = tc.inputFocusBorder}
                      onBlur={(e) => e.currentTarget.style.borderColor = tc.inputBorder}
                    >
                      <option value={1}>1 hour</option>
                      <option value={8}>8 hours</option>
                      <option value={24}>24 hours</option>
                      <option value={168}>1 week</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[13px] font-medium mb-2" style={{ color: tc.textSecondary }}>
                      Language
                    </label>
                    <select
                      value={settings.system.language}
                      onChange={(e) => handleSettingChange('system', 'language', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-[13px] outline-none transition-colors"
                      style={{ background: tc.inputBg, border: '1px solid ' + tc.inputBorder, color: tc.inputText }}
                      onFocus={(e) => e.currentTarget.style.borderColor = tc.inputFocusBorder}
                      onBlur={(e) => e.currentTarget.style.borderColor = tc.inputBorder}
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                    </select>
                  </div>

                  {/* SMTP Configuration - Admin Only */}
                  {(session?.user as any)?.isAdmin && (
                    <SMTPConfiguration />
                  )}

                  <div className="pt-4" style={{ borderTop: '1px solid ' + tc.divider }}>
                    <h3 className="text-[15px] font-medium mb-4" style={{ color: tc.textPrimary }}>System Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Version & build */}
                      <div className="rounded-lg p-4" style={{ background: tc.surfaceBg, border: '1px solid ' + tc.cardBorder }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12px] font-medium" style={{ color: tc.textMuted }}>Version &amp; Build</span>
                          {sysInfo?.git?.current && sysInfo?.git?.latest && (
                            sysInfo.git.upToDate
                              ? <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: 'rgb(16,185,129)' }}>Up to date</span>
                              : <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.14)', color: '#d97706' }}>Update available</span>
                          )}
                        </div>
                        <p className="text-[15px] font-semibold" style={{ color: tc.textPrimary }}>v{sysInfo?.version ?? '—'}</p>
                        <div className="mt-2 space-y-1 text-[12px]">
                          {sysInfo?.git?.branch && (
                            <div className="flex items-center justify-between">
                              <span style={{ color: tc.textMuted }}>branch</span>
                              <span className="truncate ml-2" style={{ color: tc.textSecondary }}>{sysInfo.git.branch}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between font-mono">
                            <span style={{ color: tc.textMuted }}>current</span>
                            <span style={{ color: tc.textSecondary }}>{sysInfo?.git?.current ?? '—'}</span>
                          </div>
                          <div className="flex items-center justify-between font-mono">
                            <span style={{ color: tc.textMuted }}>latest</span>
                            <span style={{ color: tc.textSecondary }}>{sysInfo?.git?.latest ?? 'not pushed'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Uptime */}
                      <div className="rounded-lg p-4" style={{ background: tc.surfaceBg, border: '1px solid ' + tc.cardBorder }}>
                        <span className="text-[12px] font-medium" style={{ color: tc.textMuted }}>Uptime</span>
                        <p className="text-[15px] font-semibold mt-2" style={{ color: tc.textPrimary }}>{formatUptime(sysInfo?.uptimeSeconds)}</p>
                        <p className="text-[11px] mt-1" style={{ color: tc.textFaint }}>since last restart</p>
                      </div>

                      {/* Database */}
                      <div className="rounded-lg p-4" style={{ background: tc.surfaceBg, border: '1px solid ' + tc.cardBorder }}>
                        <span className="text-[12px] font-medium" style={{ color: tc.textMuted }}>Database</span>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: sysInfo?.db?.connected ? 'rgb(16,185,129)' : '#ef4444' }} />
                          <p className="text-[15px] font-semibold" style={{ color: tc.textPrimary }}>{sysInfo?.db?.type ?? 'PostgreSQL'}</p>
                        </div>
                        <p className="text-[11px] mt-1" style={{ color: tc.textFaint }}>{sysInfo?.db ? (sysInfo.db.connected ? 'Connected' : 'Unreachable') : '…'}</p>
                      </div>

                      {/* AI system */}
                      <div className="rounded-lg p-4" style={{ background: tc.surfaceBg, border: '1px solid ' + tc.cardBorder }}>
                        <span className="text-[12px] font-medium" style={{ color: tc.textMuted }}>AI System</span>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: sysInfo?.ai?.reachable ? 'rgb(16,185,129)' : '#ef4444' }} />
                          <p className="text-[15px] font-semibold capitalize" style={{ color: tc.textPrimary }}>{sysInfo?.ai?.provider ?? '—'}</p>
                        </div>
                        <div className="mt-2 space-y-1 text-[12px]">
                          <div className="flex items-center justify-between">
                            <span style={{ color: tc.textMuted }}>Model</span>
                            <span className="font-mono" style={{ color: sysInfo?.ai?.modelPresent ? tc.textSecondary : '#d97706' }}>{sysInfo?.ai?.model ?? '—'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span style={{ color: tc.textMuted }}>Status</span>
                            <span style={{ color: sysInfo?.ai?.reachable ? 'rgb(16,185,129)' : '#ef4444' }}>
                              {sysInfo?.ai ? (sysInfo.ai.reachable ? (sysInfo.ai.modelPresent ? 'Ready' : 'Model missing') : 'Offline') : '…'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Save Button */}
            <div className="flex justify-end mt-8 pt-6" style={{ borderTop: '1px solid ' + tc.divider }}>
              <button
                onClick={handleSaveSettings}
                disabled={isLoading}
                onMouseEnter={() => setSaveHovered(true)}
                onMouseLeave={() => setSaveHovered(false)}
                className="flex items-center px-6 py-2 rounded-lg text-[13px] font-medium transition-colors"
                style={
                  isSaved
                    ? { background: tc.statusCompleted.bg, color: tc.statusCompleted.text, border: '1px solid ' + tc.statusCompleted.border }
                    : { background: saveHovered ? tc.btnPrimaryHoverBg : tc.btnPrimaryBg, color: tc.btnPrimaryText, border: '1px solid ' + tc.btnPrimaryBorder }
                }
              >
                {isLoading ? (
                  <Spinner size="sm" className="mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isSaved ? 'Saved!' : 'Save Changes'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
