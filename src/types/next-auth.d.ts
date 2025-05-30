import 'next-auth'

export enum UserRole {
  ADMIN = 'ADMIN',
  CLEANER = 'CLEANER'
}

declare module 'next-auth' {
  interface User {
    id: string
    email: string
    name?: string | null
    role: UserRole
    isAdmin: boolean
  }

  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: UserRole
      isAdmin: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    email: string
    name?: string | null
    role: UserRole
    isAdmin: boolean
  }
} 