'use client'

import { useState, Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { LoginForm } from "@/components/auth/login-form"
import { RegisterForm } from "@/components/auth/register-form"

function AuthContent() {
  const [showLogin, setShowLogin] = useState(true)
  const searchParams = useSearchParams()
  const [switchingMessage, setSwitchingMessage] = useState<string | null>(null)

  useEffect(() => {
    const email = searchParams.get('email')
    const isNew = searchParams.get('new')
    const returnTo = searchParams.get('returnTo')

    if (email) {
      setSwitchingMessage(`Switching to account: ${email}`)
    } else if (isNew) {
      setSwitchingMessage('Add a new account to CleanTrack')
      setShowLogin(false) // Show registration form for new accounts
    }
  }, [searchParams])

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm backdrop-blur-md bg-black/10 p-8 rounded-lg border border-white/5 shadow-[0_0_25px_-5px_rgba(20,184,166,0.1)] animate-container">
        <h1 className="text-3xl font-extralight mb-6 text-center tracking-wide text-teal-300 animate-glow">
          CleanTrack
        </h1>
        <p className="text-sm text-center text-gray-400 mb-6 animate-fade-in">
          {switchingMessage || 'Professional cleaning management system'}
        </p>
        
        {switchingMessage && (
          <div className="mb-4 p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg animate-fade-in">
            <p className="text-xs text-teal-300 text-center">
              {searchParams.get('email') ? 'Sign in with the account you want to switch to' : 'Create your new CleanTrack account'}
            </p>
          </div>
        )}

        <div className="animate-fade-in">
          {showLogin ? (
            <LoginForm 
              onToggle={() => setShowLogin(false)} 
              prefillEmail={searchParams.get('email') || undefined}
              returnTo={searchParams.get('returnTo') || undefined}
            />
          ) : (
            <RegisterForm 
              onToggle={() => setShowLogin(true)}
              returnTo={searchParams.get('returnTo') || undefined}
            />
          )}
        </div>
      </div>
    </main>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm backdrop-blur-md bg-black/10 p-8 rounded-lg border border-white/5 shadow-[0_0_25px_-5px_rgba(20,184,166,0.1)] animate-container">
          <h1 className="text-3xl font-extralight mb-6 text-center tracking-wide text-teal-300 animate-glow">
            CleanTrack
          </h1>
          <div className="animate-fade-in">
            <div className="space-y-4">
              <div className="h-12 bg-white/5 rounded-md animate-pulse"></div>
              <div className="h-12 bg-white/5 rounded-md animate-pulse"></div>
              <div className="h-12 bg-white/5 rounded-md animate-pulse"></div>
            </div>
          </div>
        </div>
      </main>
    }>
      <AuthContent />
    </Suspense>
  )
} 