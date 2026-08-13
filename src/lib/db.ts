import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

// prisma-client-js honored the ?schema= URL param, but the pg driver adapter
// ignores it and queries the default search_path (public). Production tables
// live in a named schema, so thread it through to the adapter explicitly.
const schemaFromUrl = (url: string | undefined) => {
  if (!url) return undefined
  try {
    return new URL(url).searchParams.get('schema') ?? undefined
  } catch {
    return undefined
  }
}

const prismaClientSingleton = () => {
  // A pg PoolConfig is intentionally used instead of a connection-string overload.
  // Its optional connectionString keeps build-time module evaluation safe when Next
  // has no DATABASE_URL, while the first real query still fails closed. The explicit
  // timeout preserves Prisma 6's bounded connection attempt; node-postgres defaults
  // to waiting indefinitely.
  const schema = schemaFromUrl(process.env.DATABASE_URL)
  const adapter = new PrismaPg(
    {
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5_000,
    },
    schema ? { schema } : undefined,
  )

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production'
      ? ['error']
      : ['query', 'error', 'warn'],
  })
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

// Use global singleton in ALL environments to prevent pool exhaustion
// (Next.js hot reloads in dev would otherwise create multiple clients)
export const prisma = globalThis.prisma ?? prismaClientSingleton()

globalThis.prisma = prisma
