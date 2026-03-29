import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const startedAt = Date.now()

export async function GET() {
  const timestamp = new Date().toISOString()
  const uptime = Math.floor((Date.now() - startedAt) / 1000)

  let dbStatus: 'healthy' | 'unhealthy' = 'unhealthy'
  let dbLatencyMs: number | null = null

  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    dbLatencyMs = Date.now() - dbStart
    dbStatus = 'healthy'
  } catch (error) {
    console.error('Health check - DB failed:', error)
  }

  const overall = dbStatus === 'healthy' ? 'healthy' : 'unhealthy'

  return NextResponse.json({
    status: overall,
    timestamp,
    uptime,
    services: {
      database: { status: dbStatus, latencyMs: dbLatencyMs },
      api: { status: 'healthy' }
    }
  }, { status: overall === 'healthy' ? 200 : 503 })
}
