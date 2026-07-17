import { NextResponse } from 'next/server'
import { requireAuth, requireAdmin, m2mSiteScopeWhere, resolveWriteSiteIds, visibleSiteRelationWhere } from '@/lib/authz'
import { prisma } from '@/lib/db'

// Get all schedules
export async function GET() {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error

    const schedules = await prisma.schedule.findMany({
      where: m2mSiteScopeWhere(auth.user),
      include: {
        sites: { where: visibleSiteRelationWhere(auth.user), select: { id: true, name: true } },
        tasks: true
      },
      orderBy: {
        title: 'asc'
      }
    })

    return NextResponse.json(schedules)
  } catch (error: any) {
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

    const { title, tasks, siteIds: requestedSiteIds, detectedFrequency, suggestedFrequency } = await req.json()

    // Only accept a valid enum value for the AI-suggested frequency.
    const validFrequencies = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']
    const safeSuggested = typeof suggestedFrequency === 'string' && validFrequencies.includes(suggestedFrequency)
      ? suggestedFrequency as import('@prisma/client').ScheduleFrequency
      : null

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

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
        detectedFrequency: typeof detectedFrequency === 'string' ? detectedFrequency.slice(0, 100) : null,
        suggestedFrequency: safeSuggested,
        sites: { connect: siteIds.map((id) => ({ id })) },
        tasks: {
          create: (tasks || []).map((t: any) => ({
            description: String(t.description || '').slice(0, 1000),
            frequency: t.frequency ? String(t.frequency).slice(0, 100) : null,
            additionalNotes: t.additionalNotes ? String(t.additionalNotes).slice(0, 2000) : null,
          }))
        }
      },
      include: {
        sites: { where: visibleSiteRelationWhere(auth.user), select: { id: true, name: true } },
        tasks: true
      }
    })

    return NextResponse.json(schedule)
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create schedule' },
      { status: 500 }
    )
  }
} 