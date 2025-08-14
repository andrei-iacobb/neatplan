'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'

export default function ChangePasswordPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const mustChange = (session?.user as any)?.forcePasswordChange === true

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: mustChange ? undefined : currentPassword, newPassword })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to change password')
      setSuccess(true)
      // Re-authenticate with new password to refresh the session/JWT flags immediately
      const email = session?.user?.email as string
      const path = (session?.user as any)?.isAdmin ? '/' : '/clean'
      const base = process.env.NEXT_PUBLIC_APP_BASE_URL || process.env.CUSTOM_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')
      const callbackUrl = base ? `${base}${path}` : path
      await signIn('credentials', { redirect: true, email, password: newPassword, callbackUrl })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4">
        <h1 className="text-xl font-semibold text-gray-100">Change Password</h1>
        {!mustChange && (
          <div>
            <label className="block text-gray-300 text-sm mb-1">Current password</label>
            <input type="password" className="w-full p-2 rounded bg-gray-700 text-gray-100" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
          </div>
        )}
        <div>
          <label className="block text-gray-300 text-sm mb-1">New password</label>
          <input type="password" className="w-full p-2 rounded bg-gray-700 text-gray-100" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm">Password changed. Redirecting…</p>}
        <button disabled={loading} className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded disabled:opacity-50">
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}


