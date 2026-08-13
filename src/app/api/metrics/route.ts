import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin, siteScopeWhere } from '@/lib/authz'


export async function GET() {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    // Tenant counts are scoped to the viewer's site (managers see their own);
    // OP/DIRECTOR get {} from siteScopeWhere and thus the global totals.
    const scope = siteScopeWhere(auth.user)
    const [users, rooms, activeSessions, pendingJobs] = await Promise.all([
      prisma.user.count({ where: scope }),
      prisma.room.count({ where: scope }),
      prisma.userSession.count({ where: { isActive: true } }),
      prisma.documentJob.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
    ])

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      users,
      rooms,
      activeSessions,
      pendingDocumentJobs: pendingJobs,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to collect metrics' }, { status: 500 })
  }
}
