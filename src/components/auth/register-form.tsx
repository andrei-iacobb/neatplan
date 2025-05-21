"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().optional(),
})

type RegisterValues = z.infer<typeof registerSchema>

export function RegisterForm({ onToggle }: { onToggle: () => void }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
  })

  async function onSubmit(data: RegisterValues) {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to register")
      }

      // Registration successful
      onToggle() // Switch back to login form
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Input
            {...form.register("email")}
            placeholder="Email"
            type="email"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            disabled={isLoading}
            className="h-12 px-4 bg-white/5 border-0 text-gray-100 placeholder:text-gray-400 focus:ring-1 focus:ring-teal-300/50 rounded-md backdrop-blur-sm transition-all"
          />
          {form.formState.errors.email && (
            <p className="text-sm text-red-400 animate-fade-in">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Input
            {...form.register("password")}
            placeholder="Password"
            type="password"
            autoCapitalize="none"
            autoComplete="new-password"
            disabled={isLoading}
            className="h-12 px-4 bg-white/5 border-0 text-gray-100 placeholder:text-gray-400 focus:ring-1 focus:ring-teal-300/50 rounded-md backdrop-blur-sm transition-all"
          />
          {form.formState.errors.password && (
            <p className="text-sm text-red-400 animate-fade-in">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Input
            {...form.register("name")}
            placeholder="Name (optional)"
            type="text"
            autoCapitalize="words"
            autoComplete="name"
            disabled={isLoading}
            className="h-12 px-4 bg-white/5 border-0 text-gray-100 placeholder:text-gray-400 focus:ring-1 focus:ring-teal-300/50 rounded-md backdrop-blur-sm transition-all"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-red-400 animate-fade-in">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>
        {error && (
          <p className="text-sm text-red-400 text-center animate-fade-in">{error}</p>
        )}
        <Button 
          type="submit" 
          disabled={isLoading}
          className="w-full h-12 font-light bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 disabled:bg-teal-900/20 disabled:text-teal-300/50 rounded-md transition-all border border-teal-500/20 hover:border-teal-500/30 backdrop-blur-sm"
        >
          {isLoading ? "Creating account..." : "Create account"}
        </Button>
      </form>
      <div className="text-center">
        <button 
          type="button" 
          className="text-sm text-gray-400 hover:text-teal-300 transition-all hover:tracking-wide"
          onClick={onToggle}
        >
          Already have an account? Sign in
        </button>
      </div>
    </div>
  )
} 