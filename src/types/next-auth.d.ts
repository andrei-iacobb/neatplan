import 'next-auth'

export enum UserRole {
  OP = 'OP',
  DIRECTOR = 'DIRECTOR',
  MANAGER = 'MANAGER',
  CLEANER = 'CLEANER'
}

declare module 'next-auth' {
  interface User {
    id: string
    email: string
    name?: string | null
    role: UserRole
    isAdmin: boolean
    siteId?: string | null
  }

  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: UserRole
      isAdmin: boolean
      siteId?: string | null
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
    siteId?: string | null
  }
}
