"use client"

import { motion } from "framer-motion"
import { useState } from "react"

interface NotificationSetting {
  id: string
  title: string
  description: string
  enabled: boolean
}

interface CleaningPreference {
  id: string
  title: string
  description: string
  value: string
  options: string[]
}

const notificationSettings: NotificationSetting[] = [
  {
    id: "due-tasks",
    title: "Due Tasks",
    description: "Get notified when tasks are due or overdue",
    enabled: true
  },
  {
    id: "weekly-summary",
    title: "Weekly Summary",
    description: "Receive a weekly summary of completed tasks and upcoming schedule",
    enabled: true
  },
  {
    id: "reminders",
    title: "Task Reminders",
    description: "Get reminded before tasks are due",
    enabled: false
  }
]

const cleaningPreferences: CleaningPreference[] = [
  {
    id: "default-frequency",
    title: "Default Cleaning Frequency",
    description: "Set the default frequency for new cleaning tasks",
    value: "weekly",
    options: ["daily", "weekly", "biweekly", "monthly"]
  },
  {
    id: "reminder-time",
    title: "Reminder Time",
    description: "How early should we remind you before a task is due",
    value: "1-day",
    options: ["1-hour", "6-hours", "12-hours", "1-day", "2-days"]
  }
]

export default function SettingsPage() {
  const [notifications, setNotifications] = useState(notificationSettings)
  const [preferences, setPreferences] = useState(cleaningPreferences)

  const toggleNotification = (id: string) => {
    setNotifications(notifications.map(notification =>
      notification.id === id
        ? { ...notification, enabled: !notification.enabled }
        : notification
    ))
  }

  const updatePreference = (id: string, value: string) => {
    setPreferences(preferences.map(preference =>
      preference.id === id
        ? { ...preference, value }
        : preference
    ))
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-100 mb-8">Settings</h1>

        {/* Notifications Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-lg font-medium text-gray-100 mb-4">Notifications</h2>
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="p-4 rounded-lg bg-black/20 backdrop-blur-sm border border-white/5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-gray-200 font-medium">{notification.title}</h3>
                    <p className="text-sm text-gray-400">{notification.description}</p>
                  </div>
                  <button
                    onClick={() => toggleNotification(notification.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notification.enabled ? 'bg-teal-500' : 'bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        notification.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Preferences Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-lg font-medium text-gray-100 mb-4">Cleaning Preferences</h2>
          <div className="space-y-4">
            {preferences.map((preference) => (
              <div
                key={preference.id}
                className="p-4 rounded-lg bg-black/20 backdrop-blur-sm border border-white/5"
              >
                <div className="flex flex-col space-y-2">
                  <h3 className="text-gray-200 font-medium">{preference.title}</h3>
                  <p className="text-sm text-gray-400">{preference.description}</p>
                  <select
                    value={preference.value}
                    onChange={(e) => updatePreference(preference.id, e.target.value)}
                    className="mt-2 block w-full rounded-md bg-white/5 border border-white/10 text-gray-300 px-3 py-2 focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                  >
                    {preference.options.map((option) => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1).replace('-', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Save Button */}
        <div className="mt-8 flex justify-end">
          <button className="px-4 py-2 bg-teal-500/10 text-teal-300 rounded-md border border-teal-500/30 hover:bg-teal-500/20 transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
} 