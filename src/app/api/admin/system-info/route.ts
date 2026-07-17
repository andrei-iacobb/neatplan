import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/authz'
import { resolveAIProvider } from '@/lib/ai-provider'
import pkg from '../../../../../package.json'

function ollamaTagsUrl(): string {
  const base = (process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/v1\/?$/, '')
  return `${base}/api/tags`
}

export const dynamic = 'force-dynamic'

const run = promisify(execFile)

// Cache the (network) "latest remote hash" lookup so we don't hit GitHub on every load.
let latestCache: { value: string | null; at: number } | null = null
const LATEST_TTL_MS = 5 * 60 * 1000

const GITHUB_REPO = 'andrei-iacobb/neatplan'

async function gitCurrent(): Promise<{ short: string | null; branch: string | null }> {
  try {
    const [{ stdout: short }, { stdout: branch }] = await Promise.all([
      run('git', ['rev-parse', '--short', 'HEAD'], { cwd: process.cwd(), timeout: 4000 }),
      run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: process.cwd(), timeout: 4000 }),
    ])
    return { short: short.trim(), branch: branch.trim() }
  } catch {
    return { short: null, branch: null }
  }
}

async function gitLatestRemote(branch: string | null): Promise<string | null> {
  if (latestCache && Date.now() - latestCache.at < LATEST_TTL_MS) return latestCache.value
  // Compare against the SAME branch on the remote only - falling back to main
  // would falsely flag an (unpushed) feature branch as "behind".
  let value: string | null = null
  for (const ref of [branch].filter(Boolean) as string[]) {
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits/${ref}`, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(6000),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.sha) { value = String(data.sha).slice(0, 7); break }
      }
    } catch {
      // offline / rate-limited - leave null
    }
  }
  latestCache = { value, at: Date.now() }
  return value
}

async function aiStatus() {
  const provider = resolveAIProvider()
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b'
  if (provider !== 'ollama') {
    return { provider, model: 'gpt-4o', reachable: true, modelPresent: true, modelCount: null as number | null }
  }
  try {
    const res = await fetch(ollamaTagsUrl(), { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return { provider, model, reachable: false, modelPresent: false, modelCount: 0 }
    const data = await res.json()
    const names: string[] = (data?.models ?? []).map((m: any) => m?.name).filter(Boolean)
    return { provider, model, reachable: true, modelPresent: names.includes(model), modelCount: names.length }
  } catch {
    return { provider, model, reachable: false, modelPresent: false, modelCount: 0 }
  }
}

async function dbStatus() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { type: 'PostgreSQL', connected: true }
  } catch {
    return { type: 'PostgreSQL', connected: false }
  }
}

export async function GET() {
  // System info (git build, AI status) is OP-only, matching the Settings System tab.
  const auth = await requireRole('OP')
  if ('error' in auth) return auth.error

  const current = await gitCurrent()
  const [latest, ai, db] = await Promise.all([
    gitLatestRemote(current.branch),
    aiStatus(),
    dbStatus(),
  ])

  return NextResponse.json({
    version: (pkg as any).version ?? '0.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    git: {
      current: current.short,
      latest,
      branch: current.branch,
      upToDate: !!current.short && !!latest && current.short === latest,
    },
    ai,
    db,
  })
}
