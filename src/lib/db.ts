import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'production'
      ? ['error']
      : ['query', 'error', 'warn'],
  })
}

declare global {
  // eslint-disable-next-line no-var
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

// Use global singleton in ALL environments to prevent pool exhaustion
// (Next.js hot reloads in dev would otherwise create multiple clients)
export const prisma = globalThis.prisma ?? prismaClientSingleton()

globalThis.prisma = prisma
