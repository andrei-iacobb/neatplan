"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { motion } from "framer-motion"
import { Eye, EyeOff, Mail, Lock } from "lucide-react"

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
  const [showPassword, setShowPassword] = useState(false)
  
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Email Field */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="space-y-2"
        >
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
            <Input
              {...form.register("email")}
              placeholder="Email address"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              className="h-14 pl-12 pr-4 bg-gray-800/50 border border-gray-700/50 text-gray-100 placeholder:text-gray-400 focus:border-teal-500/70 focus:ring-2 focus:ring-teal-500/20 rounded-xl backdrop-blur-sm transition-all duration-200 hover:border-gray-600/70"
            />
          </div>
          {form.formState.errors.email && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-red-400 font-medium"
            >
              {form.formState.errors.email.message}
            </motion.p>
          )}
        </motion.div>

        {/* Password Field */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="space-y-2"
        >
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
            <Input
              {...form.register("password")}
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              autoCapitalize="none"
              autoComplete="current-password"
              disabled={isLoading}
              className="h-14 pl-12 pr-12 bg-gray-800/50 border border-gray-700/50 text-gray-100 placeholder:text-gray-400 focus:border-teal-500/70 focus:ring-2 focus:ring-teal-500/20 rounded-xl backdrop-blur-sm transition-all duration-200 hover:border-gray-600/70"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
              disabled={isLoading}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {form.formState.errors.password && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-red-400 font-medium"
            >
              {form.formState.errors.password.message}
            </motion.p>
          )}
        </motion.div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl backdrop-blur-sm"
          >
            <p className="text-sm text-red-400 text-center font-medium">{error}</p>
          </motion.div>
        )}

        {/* Submit Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
        >
          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full h-14 font-semibold bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white disabled:from-gray-600 disabled:to-gray-700 disabled:text-gray-400 rounded-xl transition-all duration-200 border-0 shadow-lg hover:shadow-teal-500/25 hover:scale-[1.02] active:scale-[0.98]"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Signing in...
              </div>
            ) : (
              "Sign in"
            )}
          </Button>
        </motion.div>
      </form>

      {/* Toggle to Register */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="text-center pt-4 border-t border-gray-700/50"
      >
        <p className="text-sm text-gray-400 mb-2">
          Don't have an account?
        </p>
        <button 
          type="button" 
          className="text-sm font-medium text-teal-400 hover:text-teal-300 transition-all duration-200 hover:underline underline-offset-4"
          onClick={onToggle}
        >
          Create account
        </button>
      </motion.div>
    </div>
  )
} 