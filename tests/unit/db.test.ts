import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'

type PoolConfig = Extract<ConstructorParameters<typeof import('@prisma/adapter-pg').PrismaPg>[0], { connectionString?: string }>
const pg: unknown = createRequire(import.meta.url)('pg')

const mocks = vi.hoisted(() => ({
  adapter: vi.fn<(config: PoolConfig, options?: { schema?: string }) => void>(),
  client: vi.fn(),
}))
vi.mock('@prisma/adapter-pg', () => ({ PrismaPg: class {
  constructor(config: PoolConfig, options?: { schema?: string }) { mocks.adapter(config, options) }
} }))
vi.mock('@/generated/prisma/client', () => ({ PrismaClient: class {
  constructor(config: unknown) { mocks.client(config) }
} }))

const originalSingleton = globalThis.prisma
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('PGOPTIONS', undefined)
  globalThis.prisma = undefined
})
afterEach(() => {
  vi.unstubAllEnvs()
  globalThis.prisma = originalSingleton
})

async function configFor(databaseUrl?: string) {
  vi.stubEnv('DATABASE_URL', databaseUrl)
  await import('@/lib/db')
  expect(mocks.adapter).toHaveBeenCalledTimes(1)
  const [config, adapterOptions] = mocks.adapter.mock.calls[0]
  // Exercise the installed pg parser too: URL options take precedence over
  // PoolConfig, so checking the adapter arguments alone misses that regression.
  if (!pg || typeof pg !== 'object' || !('Client' in pg) || typeof pg.Client !== 'function') {
    throw new Error('The installed pg package does not expose Client')
  }
  const client: unknown = Reflect.construct(pg.Client, [config])
  return { config, adapterOptions, client }
}

function database(schema: string, options?: string) {
  const url = new URL('postgresql://test:test@localhost:55439/neatplan_stress')
  url.searchParams.set('schema', schema)
  if (options !== undefined) url.searchParams.set('options', options)
  return url.toString()
}

describe('database schema configuration', () => {
  it('sets the production schema for ORM queries and every raw SQL connection', async () => {
    const { config, adapterOptions, client } = await configFor(database('neatplan'))
    expect(adapterOptions).toEqual({ schema: 'neatplan' })
    expect(config.options).toBe('-c search_path="neatplan"')
    expect(client).toHaveProperty('connectionParameters.options', '-c search_path="neatplan"')
    expect(config.connectionTimeoutMillis).toBe(5000)
  })

  it.each(['NeatPlan_42', '_private', 'x'.repeat(63)])('preserves the exact valid schema %j', async schema => {
    const { adapterOptions, client } = await configFor(database(schema))
    expect(adapterOptions).toEqual({ schema })
    expect(client).toHaveProperty('connectionParameters.options', `-c search_path="${schema}"`)
  })

  it.each(['care home', 'care"home', 'care\\home', 'care\thome\nstore', 'care,public', 'care" -c search_path=public', '1care', 'x'.repeat(64)])('rejects unsupported schema %j before initializing the adapter', async schema => {
    vi.stubEnv('DATABASE_URL', database(schema))
    await expect(import('@/lib/db')).rejects.toThrow('The database schema must start with a letter or underscore')
    expect(mocks.adapter).not.toHaveBeenCalled()
  })

  it('preserves other URL options while keeping raw SQL aligned with the ORM schema', async () => {
    const { config, client } = await configFor(database('neatplan', '-c statement_timeout=8000 -c search_path=public'))
    const expected = '-c statement_timeout=8000 -c search_path=public -c search_path="neatplan"'
    expect(config.options).toBe(expected)
    expect(client).toHaveProperty('connectionParameters.options', expected)
    expect(new URL(config.connectionString || '').searchParams.has('options')).toBe(false)
    expect(client).toHaveProperty('connectionParameters.database', 'neatplan_stress')
    expect(client).toHaveProperty('connectionParameters.port', 55439)
  })

  it('preserves PGOPTIONS when the URL has none', async () => {
    vi.stubEnv('PGOPTIONS', '-c lock_timeout=4000')
    const { client } = await configFor(database('neatplan'))
    expect(client).toHaveProperty('connectionParameters.options', '-c lock_timeout=4000 -c search_path="neatplan"')
  })

  it('keeps pg URL-over-environment precedence for existing options', async () => {
    vi.stubEnv('PGOPTIONS', '-c lock_timeout=4000')
    const { client } = await configFor(database('neatplan', '-c statement_timeout=8000'))
    expect(client).toHaveProperty('connectionParameters.options', '-c statement_timeout=8000 -c search_path="neatplan"')
  })

  it('preserves unchanged connection behavior when no schema is selected', async () => {
    const url = 'postgresql://test:test@localhost/neatplan_stress?options=-c%20statement_timeout%3D8000'
    const { config, adapterOptions, client } = await configFor(url)
    expect(config.connectionString).toBe(url)
    expect(adapterOptions).toBeUndefined()
    expect(config.options).toBeUndefined()
    expect(client).toHaveProperty('connectionParameters.options', '-c statement_timeout=8000')
  })

  it('constructs lazily without a database URL during build evaluation', async () => {
    const { config, adapterOptions } = await configFor()
    expect(config).toEqual({ connectionString: undefined, connectionTimeoutMillis: 5000 })
    expect(adapterOptions).toBeUndefined()
    expect(mocks.client).toHaveBeenCalledTimes(1)
  })

  it('rejects null bytes instead of truncating a schema in the startup packet', async () => {
    vi.stubEnv('DATABASE_URL', database('care\0home'))
    await expect(import('@/lib/db')).rejects.toThrow('The database schema must start with a letter or underscore')
    expect(mocks.adapter).not.toHaveBeenCalled()
  })

  it('reuses the global client across module reloads', async () => {
    vi.stubEnv('DATABASE_URL', database('neatplan'))
    const first = await import('@/lib/db')
    vi.resetModules()
    const second = await import('@/lib/db')
    expect(second.prisma).toBe(first.prisma)
    expect(mocks.adapter).toHaveBeenCalledTimes(1)
  })
})
