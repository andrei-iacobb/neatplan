import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import bcrypt from "bcrypt"
import type { NextRequest } from "next/server"
import { verify } from "jsonwebtoken"

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        try {
          // Find user in database
          const result = await db.query("SELECT * FROM users WHERE username = $1", [credentials.username])

          if (result.rows.length === 0) {
            return null
          }

          const user = result.rows[0]

          // Compare passwords
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

          if (!isPasswordValid) {
            return null
          }

          return {
            id: user.id.toString(),
            name: user.username,
            email: user.username, // Using username as email since we don't have email in our schema
            role: user.role,
          }
        } catch (error) {
          console.error("Authentication error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    signOut: "/",
    error: "/login", // Error code passed in query string as ?error=
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
  debug: process.env.NODE_ENV === "development",
}

// Helper function to check if user is authenticated and has admin role
export const isAdmin = (session: any) => {
  return session?.user?.role === "admin"
}

// Helper function to get user ID from session
export const getUserId = (session: any) => {
  return session?.user?.id
}

interface DecodedToken {
  userId: string
  username: string
  role: string
  iat: number
  exp: number
}

export async function verifyAuth(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { isAuthenticated: false }
    }

    const token = authHeader.split(" ")[1]

    const decoded = verify(
      token,
      process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || "default_secret",
    ) as DecodedToken

    return {
      isAuthenticated: true,
      user: {
        userId: decoded.userId,
        username: decoded.username,
        role: decoded.role,
      },
    }
  } catch (error) {
    console.error("API auth verification error:", error)
    return { isAuthenticated: false }
  }
}

