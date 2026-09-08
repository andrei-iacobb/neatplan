import { NextResponse } from 'next/server'
import { requireAuth, requireAdmin, m2mSiteScopeWhere, resolveWriteSiteIds, visibleSiteRelationWhere, resolveReadSiteId, m2mReadSiteWhere } from '@/lib/authz'
import { prisma } from '@/lib/db'
import { createScheduleInputSchema } from '@/lib/schedule-import-validation'

// Get all schedules
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
    const requestedSiteId = new URL(request.url).searchParams.get('site')
    const siteId = resolveReadSiteId(auth.user, requestedSiteId)

    const schedules = await prisma.schedule.findMany({
      where: {
        AND: [
          m2mSiteScopeWhere(auth.user),
          m2mReadSiteWhere(siteId),
        ],
      },
      include: {
        sites: { where: visibleSiteRelationWhere(auth.user), select: { id: true, name: true } },
        // Deterministic task order so the list matches the order they were
        // entered. cuids sort by creation within the same millisecond, which
        // is what a single nested `create` produces.
        tasks: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }
      },
      orderBy: {
        title: 'asc'
      }
    })

    return NextResponse.json(schedules)
  } catch (error: unknown) {
    console.error('Error fetching schedules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 }
    )
  }
}

// Create a new schedule manually
export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid schedule data' },
        { status: 400 }
      )
    }

    const parsed = createScheduleInputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Complete the title, frequency, site and at least one task before creating this schedule.' },
        { status: 400 },
      )
    }
    const {
      title,
      tasks,
      siteIds: requestedSiteIds,
      detectedFrequency,
      suggestedFrequency,
    } = parsed.data

    const siteIds = resolveWriteSiteIds(auth.user, requestedSiteIds)
    if (siteIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one site is required to create a schedule' },
        { status: 400 }
      )
    }

    const schedule = await prisma.schedule.create({
      data: {
        title,
        detectedFrequency: detectedFrequency ?? null,
        suggestedFrequency,
        sites: { connect: siteIds.map((id) => ({ id })) },
        tasks: {
          create: tasks.map((task) => ({
            description: task.description,
            frequency: task.frequency ?? null,
            additionalNotes: task.additionalNotes ?? null,
          }))
        }
      },
      include: {
        sites: { where: visibleSiteRelationWhere(auth.user), select: { id: true, name: true } },
        // Deterministic task order so the list matches the order they were
        // entered. cuids sort by creation within the same millisecond, which
        // is what a single nested `create` produces.
        tasks: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }
      }
    })

    return NextResponse.json(schedule)
  } catch {
    return NextResponse.json(
      { error: 'Failed to create schedule' },
      { status: 500 }
    )
  }
}
