import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
  // The datasource URL is resolved from env("DATABASE_URL") declared in schema.prisma,
  // lazily at connect/query time. Do NOT pass an explicit datasources.db.url here: when
  // DATABASE_URL is unset (e.g. Next's build-time page-data collection, which has no .env),
  // passing url: undefined makes the PrismaClient constructor throw
  // (PrismaClientConstructorValidationError) and fails the production build.
  return new PrismaClient({
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
