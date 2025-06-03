"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

type LoginValues = z.infer<typeof loginSchema>

interface LoginFormProps {
  onToggle: () => void
  prefillEmail?: string
  returnTo?: string
}

export function LoginForm({ onToggle, prefillEmail, returnTo }: LoginFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: prefillEmail || "",
      password: "",
    },
  })

  async function onSubmit(data: LoginValues) {
    setIsLoading(true)
    setError(null)
    
    try {
      const result = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
      })

      if (result?.error) {
        throw new Error(result.error)
      }

      // Login successful - redirect to returnTo or dashboard
      const redirectPath = returnTo || "/"
      router.push(redirectPath)
      router.refresh()
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
            autoComplete="current-password"
            disabled={isLoading}
            className="h-12 px-4 bg-white/5 border-0 text-gray-100 placeholder:text-gray-400 focus:ring-1 focus:ring-teal-300/50 rounded-md backdrop-blur-sm transition-all"
          />
          {form.formState.errors.password && (
            <p className="text-sm text-red-400 animate-fade-in">
              {form.formState.errors.password.message}
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
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      <div className="text-center">
        <button 
          type="button" 
          className="text-sm text-gray-400 hover:text-teal-300 transition-all hover:tracking-wide"
          onClick={onToggle}
        >
          Create account
        </button>
      </div>
    </div>
  )
} 