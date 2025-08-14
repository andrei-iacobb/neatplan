import { AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/db"

export const authOptions: AuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: "/auth",
    signOut: "/auth",
    error: "/auth", // Error code passed in query string as ?error=
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user || !user.password) {
          throw new Error("Invalid credentials")
        }

        // Blocked handling
        if (user.isBlocked) {
          const now = new Date()
          if (!user.temporaryUnblockUntil || now > user.temporaryUnblockUntil) {
            throw new Error("Access denied")
          }
        }

        const isPasswordValid = await compare(credentials.password, user.password)

        if (!isPasswordValid) {
          try {
            const updated = await prisma.user.update({
              where: { id: user.id },
              data: {
                failedLoginCount: { increment: 1 },
                lastFailedLoginAt: new Date(),
              },
              select: { failedLoginCount: true }
            })
            if ((updated.failedLoginCount ?? 0) >= 5) {
              await prisma.user.update({
                where: { id: user.id },
                data: { isBlocked: true }
              })
            }
          } catch {}
          throw new Error("Invalid credentials")
        }

        // Successful login resets counters
        if (user.failedLoginCount && user.failedLoginCount > 0) {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { failedLoginCount: 0, lastFailedLoginAt: null }
            })
          } catch {}
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: (user as any).role,
          isAdmin: user.isAdmin,
          forcePasswordChange: (user as any).forcePasswordChange === true,
        }
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.name = token.name as string | null
        session.user.email = token.email as string
        session.user.role = token.role as any
        session.user.isAdmin = token.isAdmin as boolean
        ;(session.user as any).forcePasswordChange = (token as any).forcePasswordChange === true
      }
      return session
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
        token.role = user.role
        token.isAdmin = user.isAdmin
        ;(token as any).forcePasswordChange = (user as any).forcePasswordChange === true
        
        // Create session tracking entry when user signs in
        if (account) {
          try {
            const sessionToken = `session_${user.id}_${Date.now()}`
            await prisma.userSession.create({
              data: {
                userId: user.id,
                sessionToken,
                ipAddress: null, // Will be updated by middleware
                userAgent: null, // Will be updated by middleware
                loginAt: new Date(),
                lastActivity: new Date(),
                isActive: true
              }
            })
            token.sessionToken = sessionToken
          } catch (error) {
            console.error('Failed to create session tracking:', error)
          }
        }
      }
      return token
    },
    async signIn({ user, account, profile }) {
      // Additional session tracking can be done here if needed
      return true
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
} 