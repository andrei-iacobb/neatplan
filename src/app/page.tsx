"use client"

import { useState } from "react"
import { LoginForm } from "@/components/auth/login-form"
import { RegisterForm } from "@/components/auth/register-form"

export default function Home() {
  const [showLogin, setShowLogin] = useState(true)

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm backdrop-blur-md bg-black/10 p-8 rounded-lg border border-white/5 shadow-[0_0_25px_-5px_rgba(20,184,166,0.1)] animate-container">
        <h1 className="text-3xl font-extralight mb-10 text-center tracking-wide text-teal-300 animate-glow">
          CleanTrack
        </h1>
        <div className="animate-fade-in">
          {showLogin ? (
            <LoginForm onToggle={() => setShowLogin(false)} />
          ) : (
            <RegisterForm onToggle={() => setShowLogin(true)} />
          )}
        </div>
      </div>
    </main>
  )
}
