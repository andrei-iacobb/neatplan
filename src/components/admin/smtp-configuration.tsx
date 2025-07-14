'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Mail, 
  Server, 
  Lock, 
  Eye, 
  EyeOff, 
  Save, 
  TestTube, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react'
import { useSoundEffects } from '@/hooks/useSoundEffects'

interface SMTPConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
  enabled: boolean
}

const defaultConfig: SMTPConfig = {
  host: '',
  port: 587,
  secure: false,
  user: '',
  pass: '',
  from: '',
  enabled: false
}

// Popular email providers with pre-configured settings
const emailProviders = [
  {
    name: 'Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    instructions: 'Use App Password, not your regular password'
  },
  {
    name: 'Outlook/Hotmail',
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    instructions: 'Use your Microsoft account credentials'
  },
  {
    name: 'Yahoo',
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false,
    instructions: 'Use App Password from Yahoo account security'
  },
  {
    name: 'SendGrid',
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    instructions: 'Use "apikey" as username and your API key as password'
  },
  {
    name: 'Mailgun',
    host: 'smtp.mailgun.org',
    port: 587,
    secure: false,
    instructions: 'Use your Mailgun SMTP credentials'
  },
  {
    name: 'Custom',
    host: '',
    port: 587,
    secure: false,
    instructions: 'Enter your custom SMTP server details'
  }
]

export function SMTPConfiguration() {
  const { playSound } = useSoundEffects()
  const [config, setConfig] = useState<SMTPConfig>(defaultConfig)
  const [selectedProvider, setSelectedProvider] = useState('Custom')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  // Load existing configuration
  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/admin/smtp-config')
      if (response.ok) {
        const data = await response.json()
        setConfig({ ...defaultConfig, ...data })
      }
    } catch (error) {
      console.error('Failed to load SMTP config:', error)
    }
  }

  const handleProviderChange = (providerName: string) => {
    playSound('click')
    setSelectedProvider(providerName)
    const provider = emailProviders.find(p => p.name === providerName)
    if (provider && providerName !== 'Custom') {
      setConfig(prev => ({
        ...prev,
        host: provider.host,
        port: provider.port,
        secure: provider.secure
      }))
    }
  }

  const handleConfigChange = (field: keyof SMTPConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = async () => {
    setIsLoading(true)
    playSound('click')
    
    try {
      const response = await fetch('/api/admin/smtp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (response.ok) {
        playSound('success')
        setTestResult({ success: true, message: 'SMTP configuration saved successfully!' })
      } else {
        playSound('error')
        const error = await response.json()
        setTestResult({ success: false, message: error.message || 'Failed to save configuration' })
      }
    } catch (error) {
      playSound('error')
      setTestResult({ success: false, message: 'Network error occurred' })
    } finally {
      setIsLoading(false)
      setTimeout(() => setTestResult(null), 5000)
    }
  }

  const handleTest = async () => {
    setIsTesting(true)
    playSound('click')

    try {
      const response = await fetch('/api/admin/smtp-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      const result = await response.json()
      
      if (result.success) {
        playSound('success')
        setTestResult({ success: true, message: 'Test email sent successfully! Check your inbox.' })
      } else {
        playSound('error')
        setTestResult({ success: false, message: result.message || 'Test failed' })
      }
    } catch (error) {
      playSound('error')
      setTestResult({ success: false, message: 'Network error occurred' })
    } finally {
      setIsTesting(false)
      setTimeout(() => setTestResult(null), 5000)
    }
  }

  const currentProvider = emailProviders.find(p => p.name === selectedProvider)

  return (
    <div className="pt-6 border-t border-gray-700">
      <div className="flex items-center mb-4">
        <Mail className="w-5 h-5 text-teal-400 mr-2" />
        <h3 className="text-lg font-medium text-gray-200">Email Configuration (SMTP)</h3>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between mb-6 p-4 bg-gray-800/30 rounded-lg">
        <div>
          <label className="text-sm font-medium text-gray-300">Enable Email Notifications</label>
          <p className="text-xs text-gray-500">Turn on to send email notifications to users</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => handleConfigChange('enabled', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
        </label>
      </div>

      {config.enabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Email Provider
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {emailProviders.map((provider) => (
                <button
                  key={provider.name}
                  onClick={() => handleProviderChange(provider.name)}
                  className={`p-3 text-left rounded-lg border transition-colors ${
                    selectedProvider === provider.name
                      ? 'border-teal-500 bg-teal-500/10 text-teal-300'
                      : 'border-gray-600 bg-gray-800/30 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  <div className="font-medium text-sm">{provider.name}</div>
                </button>
              ))}
            </div>
            {currentProvider && currentProvider.instructions && (
              <p className="text-xs text-yellow-400 mt-2 flex items-center">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {currentProvider.instructions}
              </p>
            )}
          </div>

          {/* SMTP Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Server className="w-4 h-4 inline mr-1" />
                SMTP Host
              </label>
              <input
                type="text"
                value={config.host}
                onChange={(e) => handleConfigChange('host', e.target.value)}
                placeholder="smtp.gmail.com"
                className="input-primary w-full px-3 py-2 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Port
              </label>
              <input
                type="number"
                value={config.port}
                onChange={(e) => handleConfigChange('port', parseInt(e.target.value))}
                placeholder="587"
                className="input-primary w-full px-3 py-2 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Username/Email
              </label>
              <input
                type="email"
                value={config.user}
                onChange={(e) => handleConfigChange('user', e.target.value)}
                placeholder="your-email@gmail.com"
                className="input-primary w-full px-3 py-2 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Lock className="w-4 h-4 inline mr-1" />
                Password/App Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={config.pass}
                  onChange={(e) => handleConfigChange('pass', e.target.value)}
                  placeholder="••••••••••••"
                  className="input-primary w-full px-3 py-2 rounded-lg pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                From Email Address
              </label>
              <input
                type="email"
                value={config.from}
                onChange={(e) => handleConfigChange('from', e.target.value)}
                placeholder="CleanTrack <noreply@yourcompany.com>"
                className="input-primary w-full px-3 py-2 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                This will appear as the sender in all notification emails
              </p>
            </div>
          </div>

          {/* Security Settings */}
          <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-300">Use SSL/TLS</label>
              <p className="text-xs text-gray-500">Enable secure connection (recommended for port 465)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.secure}
                onChange={(e) => handleConfigChange('secure', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
            </label>
          </div>

          {/* Test Result */}
          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg flex items-center ${
                testResult.success 
                  ? 'bg-green-500/10 border border-green-500/30 text-green-300'
                  : 'bg-red-500/10 border border-red-500/30 text-red-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 mr-2" />
              ) : (
                <XCircle className="w-5 h-5 mr-2" />
              )}
              {testResult.message}
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleTest}
              disabled={isTesting || !config.host || !config.user}
              className="btn-secondary flex items-center px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {isTesting ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="w-4 h-4 mr-2" />
              )}
              Test Connection
            </button>

            <button
              onClick={handleSave}
              disabled={isLoading}
              className="btn-primary flex items-center px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Configuration
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
} 