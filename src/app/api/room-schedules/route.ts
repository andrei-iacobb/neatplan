import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, nestedSiteScopeWhere, resolveReadSiteId, nestedReadSiteWhere } from '@/lib/authz'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const requestedSiteId = new URL(request.url).searchParams.get('site')
    const siteId = resolveReadSiteId(auth.user, requestedSiteId)

    // Status transitions (COMPLETED -> PENDING re-arm, PENDING -> OVERDUE) are
    // handled by runScheduleCheck() via the scheduler/cron - GET stays read-only.
    const roomSchedules = await prisma.roomSchedule.findMany({
      where: {
        AND: [
          nestedSiteScopeWhere(auth.user, 'room'),
          nestedReadSiteWhere(siteId, 'room'),
        ],
      },
      include: {
        schedule: true
      },
      orderBy: {
        nextDue: 'asc'
      }
    })

    return NextResponse.json(roomSchedules)
  } catch (error) {
    console.error('Error fetching room schedules:', error)
    return NextResponse.json(
      { error: 'Error fetching room schedules' },
      { status: 500 }
    )
  }
}
