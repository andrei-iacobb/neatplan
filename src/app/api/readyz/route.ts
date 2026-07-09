import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Readiness probe — returns 200 only when the app can serve traffic.
 * Use for Kubernetes readinessProbe or load-balancer health checks.
 */
export async function GET() {
  const checks: Record<string, { ready: boolean }> = {}

  // Database is the only hard dependency for serving traffic. The AI provider is optional
  // (self-hosted deployments run local Ollama with no OpenAI key), so it must NOT gate
  // readiness - previously a missing OPENAI_API_KEY returned 503 and took the app out of
  // rotation even though it was fully functional. We also avoid echoing which providers or
  // keys are configured, to not disclose configuration to unauthenticated probes.
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { ready: true }
  } catch (error) {
    checks.database = { ready: false }
  }

  const allReady = Object.values(checks).every(c => c.ready)

  return NextResponse.json(
    { ready: allReady, checks },
    { status: allReady ? 200 : 503 }
  )
}
