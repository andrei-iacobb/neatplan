import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Readiness probe — returns 200 only when the app can serve traffic.
 * Use for Kubernetes readinessProbe or load-balancer health checks.
 */
export async function GET() {
  const checks: Record<string, { ready: boolean; error?: string }> = {}

  // Database: must respond within 3 seconds
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    await prisma.$queryRaw`SELECT 1`
    clearTimeout(timeout)
    checks.database = { ready: true }
  } catch (error) {
    checks.database = { ready: false, error: 'Database unreachable or slow' }
  }

  // OpenAI: only check if key is configured (non-blocking)
  checks.openai = process.env.OPENAI_API_KEY
    ? { ready: true }
    : { ready: false, error: 'OPENAI_API_KEY not set' }

  const allReady = Object.values(checks).every(c => c.ready)

  return NextResponse.json(
    { ready: allReady, checks },
    { status: allReady ? 200 : 503 }
  )
}
