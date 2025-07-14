'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
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
  Trash2,
  Volume2
} from 'lucide-react'
import { useSettings } from '@/contexts/settings-context'
import { useSoundEffects } from '@/hooks/useSoundEffects'
import { SMTPConfiguration } from '@/components/admin/smtp-configuration'

export default function SettingsPage() {
  const { data: session } = useSession()
  const { settings, updateSetting, saveSettings, isLoading, resolvedTheme } = useSettings()
  const { playSound } = useSoundEffects()
  const [activeTab, setActiveTab] = useState('profile')
  const [isSaved, setIsSaved] = useState(false)

  const handleSaveSettings = async () => {
    try {
      await saveSettings()
      playSound('success')
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    } catch (error) {
      playSound('error')
      console.error('Error saving settings:', error)
    }
  }

  const handleSettingChange = (section: keyof typeof settings, key: string, value: any) => {
    updateSetting(section, key, value)
    if (settings.system.autoSave) {
      playSound('click')
    }
  }

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'privacy', name: 'Privacy & Security', icon: Shield },
    { id: 'system', name: 'System', icon: SettingsIcon },
  ]

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  return (
    <div className="max-w-7xl mx-auto relative z-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Settings</h1>
        <p className="text-gray-400">Manage your preferences and account settings</p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Navigation */}
        <div className="w-64 flex-shrink-0">
          <div className="card p-4 sticky top-6">
            <nav className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                  }`}
                >
                  <tab.icon className="w-4 h-4 mr-3" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="card p-6">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-gray-100 mb-4">Profile Settings</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      defaultValue={session?.user?.name || ''}
                      className="input-primary w-full px-3 py-2 rounded-lg"
                      placeholder="Enter your name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      defaultValue={session?.user?.email || ''}
                      className="input-primary w-full px-3 py-2 rounded-lg"
                      placeholder="Enter your email"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Role
                    </label>
                    <div className="input-primary w-full px-3 py-2 rounded-lg bg-gray-800/50">
                      {(session?.user as any)?.role || 'User'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Time Zone
                    </label>
                    <select className="input-primary w-full px-3 py-2 rounded-lg">
                      <option>UTC-8 (Pacific Time)</option>
                      <option>UTC-5 (Eastern Time)</option>
                      <option>UTC+0 (GMT)</option>
                      <option>UTC+1 (Central European Time)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-700">
                  <h3 className="text-lg font-medium text-gray-200 mb-4">Change Password</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="password"
                      placeholder="Current password"
                      className="input-primary px-3 py-2 rounded-lg"
                    />
                    <input
                      type="password"
                      placeholder="New password"
                      className="input-primary px-3 py-2 rounded-lg"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-gray-100 mb-4">Appearance Settings</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Theme
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {themeOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            handleSettingChange('theme', 'theme', option.value)
                            playSound('click')
                          }}
                          onMouseEnter={() => playSound('hover')}
                          className={`flex items-center justify-center p-4 rounded-lg border transition-colors ${
                            settings.theme === option.value
                              ? 'border-teal-500 bg-teal-500/10 text-teal-300'
                              : 'border-gray-600 bg-gray-800/30 text-gray-400 hover:border-gray-500'
                          }`}
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
                        <label className="text-sm font-medium text-gray-300">Compact Mode</label>
                        <p className="text-xs text-gray-500">Reduce spacing and padding</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.display.compactMode}
                          onChange={(e) => handleSettingChange('display', 'compactMode', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-300">Animations</label>
                        <p className="text-xs text-gray-500">Enable smooth transitions and animations</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.display.animationsEnabled}
                          onChange={(e) => handleSettingChange('display', 'animationsEnabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-300">Sound Effects</label>
                        <p className="text-xs text-gray-500">Play sounds for interactions</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.display.soundEnabled}
                          onChange={(e) => handleSettingChange('display', 'soundEnabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-gray-100 mb-4">Notification Settings</h2>
                
                <div className="space-y-4">
                  {Object.entries(settings.notifications).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-300 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </label>
                        <p className="text-xs text-gray-500">
                          {key === 'email' && 'Receive notifications via email'}
                          {key === 'push' && 'Receive browser push notifications'}
                          {key === 'taskReminders' && 'Get reminders for upcoming tasks'}
                          {key === 'scheduleUpdates' && 'Notifications when schedules change'}
                          {key === 'systemAlerts' && 'Important system notifications'}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => handleSettingChange('notifications', key, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                      </label>
                    </div>
                  ))}

                  {/* Test Email Section */}
                  <div className="pt-4 border-t border-gray-700">
                    <h3 className="text-lg font-medium text-gray-200 mb-4">Test Email Notifications</h3>
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
                              playSound('click')
                              const response = await fetch(`/api/notifications/email?type=${test.type}&email=${session?.user?.email}`)
                              const result = await response.json()
                              if (result.sent) {
                                playSound('success')
                              } else {
                                playSound('error')
                              }
                              console.log('Test email result:', result)
                            } catch (error) {
                              playSound('error')
                              console.error('Test email error:', error)
                            }
                          }}
                          className="btn-secondary text-xs px-3 py-2 rounded"
                        >
                          {test.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Click to send test emails to {session?.user?.email}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-gray-100 mb-4">Privacy & Security</h2>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Profile Visibility
                    </label>
                    <select 
                      value={settings.privacy.profileVisibility}
                      onChange={(e) => handleSettingChange('privacy', 'profileVisibility', e.target.value)}
                      className="input-primary w-full px-3 py-2 rounded-lg"
                    >
                      <option value="public">Public</option>
                      <option value="team">Team Only</option>
                      <option value="private">Private</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-300">Activity Tracking</label>
                      <p className="text-xs text-gray-500">Allow tracking of your activity for analytics</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.privacy.activityTracking}
                        onChange={(e) => handleSettingChange('privacy', 'activityTracking', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-300">Analytics Opt-in</label>
                      <p className="text-xs text-gray-500">Help improve the app by sharing usage data</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.privacy.analyticsOptIn}
                        onChange={(e) => handleSettingChange('privacy', 'analyticsOptIn', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                  <div className="pt-4 border-t border-gray-700">
                    <h3 className="text-lg font-medium text-gray-200 mb-4">Data Management</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button className="btn-secondary flex items-center justify-center px-4 py-2 rounded-lg">
                        <Download className="w-4 h-4 mr-2" />
                        Export Data
                      </button>
                      <button className="bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 transition-colors flex items-center justify-center px-4 py-2 rounded-lg">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* System Tab */}
            {activeTab === 'system' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-gray-100 mb-4">System Settings</h2>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-300">Auto-save</label>
                      <p className="text-xs text-gray-500">Automatically save changes</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.system.autoSave}
                        onChange={(e) => handleSettingChange('system', 'autoSave', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Session Timeout (hours)
                    </label>
                    <select 
                      value={settings.system.sessionTimeout}
                      onChange={(e) => handleSettingChange('system', 'sessionTimeout', parseInt(e.target.value))}
                      className="input-primary w-full px-3 py-2 rounded-lg"
                    >
                      <option value={1}>1 hour</option>
                      <option value={8}>8 hours</option>
                      <option value={24}>24 hours</option>
                      <option value={168}>1 week</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Language
                    </label>
                    <select 
                      value={settings.system.language}
                      onChange={(e) => handleSettingChange('system', 'language', e.target.value)}
                      className="input-primary w-full px-3 py-2 rounded-lg"
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

                  <div className="pt-4 border-t border-gray-700">
                    <h3 className="text-lg font-medium text-gray-200 mb-4">System Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Version:</span>
                        <span className="text-gray-200 ml-2">1.0.0</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Last Update:</span>
                        <span className="text-gray-200 ml-2">Jan 15, 2025</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Database:</span>
                        <span className="text-gray-200 ml-2">PostgreSQL</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Uptime:</span>
                        <span className="text-gray-200 ml-2">99.9%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Save Button */}
            <div className="flex justify-end mt-8 pt-6 border-t border-gray-700">
              <button
                onClick={handleSaveSettings}
                disabled={isLoading}
                className={`btn-primary flex items-center px-6 py-2 rounded-lg ${
                  isSaved ? 'bg-green-500/20 text-green-300 border-green-500/30' : ''
                }`}
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : isSaved ? (
                  <Save className="w-4 h-4 mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isSaved ? 'Saved!' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 