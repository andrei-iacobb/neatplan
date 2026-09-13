import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, Prisma } from '../src/generated/prisma/client'

// Run on a disposable database only:
// node --import tsx scripts/verify-database-schema.ts
// Each child imports the real shared client in a fresh process. This avoids
// fooling the test with an already-created singleton or a cached module import.
function disposableDatabase() {
  const url = new URL(process.env.DATABASE_URL || 'invalid:')
  assert(['postgres:', 'postgresql:'].includes(url.protocol), 'Use PostgreSQL')
  assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Use a loopback database')
  assert.equal(url.pathname, '/neatplan_stress', 'Only the disposable neatplan_stress database is supported')
  assert([...url.searchParams.keys()].every(key => key === 'schema' || key === 'options'), 'Unexpected database URL connection override')
  return url
}

async function probe(schema: string) {
  const url = disposableDatabase()
  assert.equal(url.searchParams.get('schema'), schema)
  const { prisma } = await import('../src/lib/db')
  try {
    const outcomes = await Promise.allSettled(Array.from({ length: 6 }, () => prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{ schema: string; total: bigint; pid: number }>>`
        SELECT current_schema() AS schema, pg_backend_pid() AS pid,
          (SELECT count(*) FROM users) AS total, pg_sleep(0.1)::text`
      assert.equal(rows[0].schema, schema, 'Raw SQL must use the requested schema')
      assert.equal(Number(rows[0].total), 1, 'Raw SQL must read the isolated fixture table')
      assert.equal(await tx.user.count(), 1, 'ORM and raw SQL must read the same table')
      return rows[0].pid
    })))
    const pids = outcomes.map(result => {
      if (result.status === 'rejected') throw result.reason
      return result.value
    })
    assert(new Set(pids).size >= 2, 'The probe must exercise more than one pooled connection')
    console.log(JSON.stringify({ schema, transactions: outcomes.length, pooledConnections: new Set(pids).size, ormAndRawAgree: true }))
  } finally { await prisma.$disconnect() }
}

async function main() {
  const url = disposableDatabase()
  const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), connectionTimeoutMillis: 5000 }) })
  const prefix = `npcheck_${randomUUID().replaceAll('-', '').slice(0, 20)}`
  const schemas = [prefix, `${prefix}_Mixed_42`]
  const created: string[] = []
  try {
    for (const schema of schemas) {
      // Identifiers cannot use SQL value placeholders. These names contain only
      // our random prefix and a fixed suffix; quoting preserves mixed case.
      const identifier = Prisma.raw(`"${schema.replaceAll('"', '""')}"`)
      await admin.$executeRaw(Prisma.sql`CREATE SCHEMA ${identifier}`)
      created.push(schema)
      await admin.$executeRaw(Prisma.sql`CREATE TABLE ${identifier}.users (id text PRIMARY KEY)`)
      await admin.$executeRaw(Prisma.sql`INSERT INTO ${identifier}.users (id) VALUES ('fixture')`)
      const childUrl = new URL(url)
      childUrl.searchParams.set('schema', schema)
      // A conflicting URL option reproduces pg's URL-over-PoolConfig precedence.
      childUrl.searchParams.set('options', '-c statement_timeout=5000 -c search_path=public')
      await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, ['--import', 'tsx', process.argv[1], '--probe', schema], {
          env: { ...process.env, DATABASE_URL: childUrl.toString(), NODE_ENV: 'production' },
          stdio: 'inherit',
        })
        child.once('error', reject)
        child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Schema probe failed (${signal || code})`)))
      })
    }
  } finally {
    try {
      for (const schema of created) {
        assert(schema.startsWith(prefix), 'Refusing to drop an unrelated schema')
        const identifier = Prisma.raw(`"${schema.replaceAll('"', '""')}"`)
        await admin.$executeRaw(Prisma.sql`DROP SCHEMA ${identifier} CASCADE`)
      }
    } finally { await admin.$disconnect() }
  }
}

async function run() {
  if (process.argv[2] === '--probe') {
    const schema = process.argv[3]
    assert(schema?.startsWith('npcheck_'), 'A generated fixture schema is required')
    await probe(schema)
  } else {
    await main()
  }
}

run().catch(error => {
  console.error(error instanceof Error ? error.message : 'Database schema verification failed')
  process.exitCode = 1
})
