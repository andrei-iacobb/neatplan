import { connection, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  await connection()
  const timestamp = new Date().toISOString()
  const uptime = Math.floor(process.uptime())

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
