import NextAuth, { AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

// Simple in-memory user store (replace with your preferred storage)
const users = [
  {
    id: "1",
    username: "admin",
    password: "admin123",
    role: "admin"
  },
  {
    id: "2",
    username: "cleaner",
    password: "cleaner123",
    role: "cleaner"
  }
]

const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Please enter both username and password")
        }

        const user = users.find(
          (u) => u.username === credentials.username && u.password === credentials.password
        )

        if (!user) {
          throw new Error("Invalid username or password")
        }

        return {
          id: user.id,
          username: user.username,
          role: user.role
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role
        token.username = user.username
      }
      return token
    },
    async session({ session, token }: any) {
      if (token) {
        session.user.role = token.role
        session.user.username = token.username
      }
      return session
    }
  },
  pages: {
    signIn: "/login"
  },
  session: {
    strategy: "jwt" as const
  }
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
