'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/url-utils'

export function TotpSettings() {
  const [enabled, setEnabled] = useState(false)
  const [available, setAvailable] = useState(false)
  const [setupUri, setSetupUri] = useState<string | null>(null)
  const [token, setToken] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiRequest('/api/auth/totp')
      .then((res) => res.json())
      .then((data) => {
        setEnabled(Boolean(data.enabled))
        setAvailable(Boolean(data.available))
      })
      .catch(() => {})
  }, [])

  async function runAction(action: 'setup' | 'enable' | 'disable') {
    setLoading(true)
    setMessage(null)
    try {
      const res = await apiRequest('/api/auth/totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      if (action === 'setup') {
        setSetupUri(data.uri)
        setMessage('Scan the URI in your authenticator app, then enter a code to enable.')
      }
      if (action === 'enable') {
        setEnabled(true)
        setSetupUri(null)
        setToken('')
        setMessage('Two-factor authentication enabled.')
      }
      if (action === 'disable') {
        setEnabled(false)
        setSetupUri(null)
        setToken('')
        setMessage('Two-factor authentication disabled.')
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  if (!available) {
    return <p className="text-sm text-gray-400">2FA is available for admin accounts only.</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Status: {enabled ? 'Enabled' : 'Disabled'}
      </p>
      {setupUri && (
        <p className="text-xs break-all text-gray-500">{setupUri}</p>
      )}
      <Input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="6-digit authenticator code"
        inputMode="numeric"
        aria-label="Authenticator code"
      />
      <div className="flex flex-wrap gap-2">
        {!enabled && (
          <Button type="button" disabled={loading} onClick={() => runAction('setup')}>
            Generate setup
          </Button>
        )}
        {!enabled && setupUri && (
          <Button type="button" disabled={loading || token.length < 6} onClick={() => runAction('enable')}>
            Enable 2FA
          </Button>
        )}
        {enabled && (
          <Button type="button" disabled={loading || token.length < 6} onClick={() => runAction('disable')}>
            Disable 2FA
          </Button>
        )}
      </div>
      {message && <p className="text-sm text-gray-300">{message}</p>}
    </div>
  )
}
