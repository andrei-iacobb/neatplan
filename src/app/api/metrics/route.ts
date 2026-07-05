import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [users, rooms, activeSessions, pendingJobs] = await Promise.all([
      prisma.user.count(),
      prisma.room.count(),
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
