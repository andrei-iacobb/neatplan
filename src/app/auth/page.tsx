'use client'

import { useState, Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { LoginForm } from "@/components/auth/login-form"
import { RegisterForm } from "@/components/auth/register-form"
import { WaveBackground } from "@/components/ui/wave-background"
import { Logo } from "@/components/ui/logo"
import { motion } from "framer-motion"

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
    <>
      <WaveBackground />
      <main className="min-h-screen flex items-center justify-center p-4 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Main Container */}
          <div className="backdrop-blur-xl bg-gray-900/40 border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden animate-container">
            {/* Header Section */}
            <div className="p-8 pb-6 text-center relative">
              {/* Background glow effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-teal-500/5 to-transparent"></div>
              
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="relative"
              >
                {/* Logo */}
                <div className="mb-4">
                  <Logo 
                    size="lg" 
                    priority 
                    className="mx-auto drop-shadow-lg" 
                  />
                </div>
                
                <h1 className="text-3xl font-bold mb-2 text-gray-100 animate-glow">
                  CleanTrack
                </h1>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {switchingMessage || 'Professional cleaning management system'}
                </p>
              </motion.div>
            </div>
            
            {/* Switching Message */}
            {switchingMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.3 }}
                className="mx-6 mb-4"
              >
                <div className="p-4 bg-teal-500/10 border border-teal-500/20 rounded-xl backdrop-blur-sm">
                  <p className="text-sm text-teal-300 text-center font-medium">
                    {searchParams.get('email') ? 'Sign in with the account you want to switch to' : 'Create your new CleanTrack account'}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Form Section */}
            <div className="px-8 pb-8">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
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
              </motion.div>
            </div>
          </div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-center mt-6"
          >
            <p className="text-xs text-gray-500">
              Secure • Reliable • Professional
            </p>
          </motion.div>
        </motion.div>
      </main>
    </>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <>
        <WaveBackground />
        <main className="min-h-screen flex items-center justify-center p-4 relative z-10">
          <div className="w-full max-w-md">
            <div className="backdrop-blur-xl bg-gray-900/40 border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden animate-container">
              <div className="p-8 pb-6 text-center">
                <div className="mb-4">
                  <Logo 
                    size="lg" 
                    priority 
                    className="mx-auto drop-shadow-lg" 
                  />
                </div>
                <h1 className="text-3xl font-bold mb-2 text-gray-100 animate-glow">
                  CleanTrack
                </h1>
                <p className="text-gray-400 text-sm">
                  Loading...
                </p>
              </div>
              <div className="px-8 pb-8">
                <div className="space-y-4">
                  <div className="h-12 bg-gray-700/30 rounded-xl animate-pulse"></div>
                  <div className="h-12 bg-gray-700/30 rounded-xl animate-pulse"></div>
                  <div className="h-12 bg-gray-700/30 rounded-xl animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </>
    }>
      <AuthContent />
    </Suspense>
  )
} 