import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

const databaseConfig = (connectionString: string | undefined) => {
  if (!connectionString) return { connectionString }
  let url: URL
  try {
    url = new URL(connectionString)
  } catch {
    return { connectionString }
  }
  const schema = url.searchParams.get('schema')
  if (!schema) return { connectionString }
  // The adapter interpolates schema names in ORM SQL. Restrict names to the
  // identifier subset it handles safely; PostgreSQL truncates identifiers at 63 bytes.
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema) || schema.length > 63) {
    throw new Error('The database schema must start with a letter or underscore, contain only letters, digits or underscores, and be at most 63 characters.')
  }

  // Prisma qualifies ORM queries, but raw SQL uses the connection search_path.
  // Set it in the startup packet so every pooled connection is ready before its
  // first query. Quotes preserve mixed-case schema names.
  const searchPath = `"${schema}"`
  const previousOptions = url.searchParams.getAll('options').at(-1) || process.env.PGOPTIONS
  const options = [previousOptions, `-c search_path=${searchPath}`].filter(Boolean).join(' ')

  // pg merges URL parameters over PoolConfig. Move existing options out of the
  // URL or they would overwrite our search_path while leaving ORM queries valid.
  url.searchParams.delete('options')
  return { connectionString: url.toString(), schema, options }
}

const prismaClientSingleton = () => {
  // A pg PoolConfig is intentionally used instead of a connection-string overload.
  // Its optional connectionString keeps build-time module evaluation safe when Next
  // has no DATABASE_URL, while the first real query still fails closed. The explicit
  // timeout preserves Prisma 6's bounded connection attempt; node-postgres defaults
  // to waiting indefinitely.
  const { schema, ...connection } = databaseConfig(process.env.DATABASE_URL)
  const adapter = new PrismaPg(
    {
      ...connection,
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
