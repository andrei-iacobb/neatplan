'use client'

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { LoginForm } from "@/components/auth/login-form"
import { RegisterForm } from "@/components/auth/register-form"

function AuthContent() {
  const [showLogin, setShowLogin] = useState(true)
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')
  const isAddAccountMode = mode === 'add-account'

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm backdrop-blur-md bg-black/10 p-8 rounded-lg border border-white/5 shadow-[0_0_25px_-5px_rgba(20,184,166,0.1)] animate-container">
        <h1 className="text-3xl font-extralight mb-6 text-center tracking-wide text-teal-300 animate-glow">
          CleanTrack
        </h1>
        {isAddAccountMode && (
          <p className="text-sm text-center text-gray-400 mb-6 animate-fade-in">
            Sign in with a different account to add it to your account switcher
          </p>
        )}
        <div className="animate-fade-in">
          {showLogin ? (
            <LoginForm onToggle={() => setShowLogin(false)} isAddAccountMode={isAddAccountMode} />
          ) : (
            <RegisterForm onToggle={() => setShowLogin(true)} />
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