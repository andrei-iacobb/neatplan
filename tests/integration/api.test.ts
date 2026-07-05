import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('health route', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', process.env.DATABASE_URL || '')
  })

  it('exports GET handler', async () => {
    const { GET } = await import('@/app/api/health/route')
    expect(typeof GET).toBe('function')
  })
})

describe('cron route', () => {
  it('rejects unauthorized calls', async () => {
    const { GET } = await import('@/app/api/cron/check-schedules/route')
    const res = await GET(new Request('http://localhost/api/cron/check-schedules'))
    expect(res.status).toBe(401)
  })
})
