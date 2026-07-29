import { AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/db"
import { randomBytes } from "crypto"
import { isManagementRole } from "@/lib/roles"

// Precomputed bcrypt hash used to equalize response timing when an account does not exist,
// so an attacker cannot distinguish "no such user" from "wrong password" by response time.
const DUMMY_PASSWORD_HASH = "$2b$12$6DaBpEkN94lWEll0A5lJ5.DT6SmfXqHsu3A6zDqshZrzW5ECsOhXy"

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
        password: { label: "Password", type: "password" },
        totpCode: { label: "Authentication Code", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user || !user.password) {
          // Run a dummy compare so the unknown-account path takes about as long as a real
          // password check, preventing username enumeration via timing.
          await compare(credentials.password, DUMMY_PASSWORD_HASH)
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
          } catch (error) {
            console.error('Failed to update login attempt counter:', error)
          }
          throw new Error("Invalid credentials")
        }

        if (user.totpEnabled && user.totpSecret) {
          const totpCode = credentials.totpCode?.trim()
          if (!totpCode) {
            throw new Error("TOTP_REQUIRED")
          }
          const { verifyTotp } = await import('@/lib/totp')
          if (!verifyTotp(user.totpSecret, totpCode)) {
            // Count TOTP failures toward the same lockout as password failures, so the
            // second factor cannot be brute-forced without tripping the account lock.
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
            } catch (error) {
              console.error('Failed to update TOTP failure counter:', error)
            }
            throw new Error("Invalid authentication code")
          }
        }

        // Successful login resets counters
        if (user.failedLoginCount && user.failedLoginCount > 0) {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { failedLoginCount: 0, lastFailedLoginAt: null }
            })
          } catch (error) {
            console.error('Failed to reset login attempt counter:', error)
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: (user as any).role,
          // isAdmin is derived from the role hierarchy (management = anything but CLEANER)
          // so authz never depends on a possibly-stale DB boolean.
          isAdmin: isManagementRole((user as any).role),
          siteId: (user as any).siteId ?? null,
          forcePasswordChange: (user as any).forcePasswordChange === true,
        }
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      // Revoked in the jwt callback (account blocked, deleted, or signed out). Drop the
      // user entirely so every `session?.user` guard in the API layer fails closed.
      if ((token as any)?.revoked || !token?.id) {
        return { expires: session.expires } as any
      }
      if (token) {
        session.user.id = token.id as string
        session.user.name = token.name as string | null
        session.user.email = token.email as string
        session.user.role = token.role as any
        session.user.isAdmin = isManagementRole(token.role as any)
        ;(session.user as any).siteId = (token as any).siteId ?? null
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
        token.isAdmin = isManagementRole(user.role as any)
        ;(token as any).siteId = (user as any).siteId ?? null
        ;(token as any).forcePasswordChange = (user as any).forcePasswordChange === true
        
        // Create session tracking entry when user signs in
        if (account) {
          try {
            // Generate cryptographically secure random session token
            const sessionToken = randomBytes(32).toString('hex')
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
        return token
      }

      // Existing token on a later request. NextAuth only populated it at sign-in, so
      // without this a demotion, site move, block or sign-out stayed ineffective for
      // the full 24h token lifetime. Re-read the account on every session check.
      // No subject means there is nothing to revalidate against, so it cannot authorize
      // anything. NextAuth re-issues a stripped token after a revoked session is read,
      // and letting that through left `session.user` populated enough to pass the
      // `!session?.user` guards in the API layer. Fail closed.
      if (!token.id) {
        ;(token as any).revoked = true
        return token
      }

      try {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            email: true,
            name: true,
            role: true,
            siteId: true,
            isBlocked: true,
            temporaryUnblockUntil: true,
            forcePasswordChange: true,
          },
        })

        if (!fresh) {
          ;(token as any).revoked = true
          return token
        }

        const blocked =
          fresh.isBlocked &&
          (!fresh.temporaryUnblockUntil || new Date() > fresh.temporaryUnblockUntil)
        if (blocked) {
          ;(token as any).revoked = true
          return token
        }

        // Honour an explicit sign-out: /api/session-tracking deactivates the tracked row
        // for this exact sessionToken. A missing row means it was pruned by the 90-day
        // cleanup, which is not a revocation.
        if (token.sessionToken) {
          const tracked = await prisma.userSession.findUnique({
            where: { sessionToken: token.sessionToken as string },
            select: { isActive: true },
          })
          if (tracked && !tracked.isActive) {
            ;(token as any).revoked = true
            return token
          }
        }

        ;(token as any).revoked = false
        token.email = fresh.email
        token.name = fresh.name
        token.role = fresh.role as any
        token.isAdmin = isManagementRole(fresh.role as any)
        ;(token as any).siteId = fresh.siteId ?? null
        ;(token as any).forcePasswordChange = fresh.forcePasswordChange === true
      } catch (error) {
        // Never widen access because the database blipped - fail closed.
        console.error('Failed to revalidate session:', error)
        ;(token as any).revoked = true
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