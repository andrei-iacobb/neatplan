import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin, canAccessAnySite, resolveWriteSiteIds, visibleSiteRelationWhere, canMutateSchedule } from '@/lib/authz'
import { canAccessAllSites } from '@/lib/roles'
import { Prisma } from '@prisma/client'

// Update a schedule
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const params = await context.params
    const { id } = params
    const { title, siteIds: requestedSiteIds } = await req.json()

    const existing = await prisma.schedule.findUnique({
      where: { id },
      select: { sites: { select: { id: true } } }
    })
    if (!existing || !canAccessAnySite(auth.user, existing.sites.map((s) => s.id))) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // MANAGER/CLEANER can only mutate schedules linked to exactly their own site.
    // OP/DIRECTOR can mutate any schedule.
    if (!canMutateSchedule(auth.user, existing)) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const data: Prisma.ScheduleUpdateInput = {}
    if (title !== undefined) data.title = title

    // Only OP/DIRECTOR may relink a schedule to a different set of sites. A
    // MANAGER can never move a schedule off (or onto) another site, so their
    // requested siteIds are ignored and the existing links are left untouched.
    if (requestedSiteIds !== undefined && canAccessAllSites(auth.user.role)) {
      const siteIds = resolveWriteSiteIds(auth.user, requestedSiteIds)
      if (siteIds.length === 0) {
        return NextResponse.json(
          { error: 'At least one site is required to create a schedule' },
          { status: 400 }
        )
      }
      data.sites = { set: siteIds.map((sid) => ({ id: sid })) }
    }

    const schedule = await prisma.schedule.update({
      where: { id },
      data,
      include: {
        sites: { where: visibleSiteRelationWhere(auth.user), select: { id: true, name: true } },
        tasks: true
      }
    })

    return NextResponse.json(schedule)
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update schedule' },
      { status: 500 }
    )
  }
}

// Partial update a schedule (PATCH method)
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const params = await context.params
    const { id } = params

    const existing = await prisma.schedule.findUnique({
      where: { id },
      select: { sites: { select: { id: true } } }
    })
    if (!existing || !canAccessAnySite(auth.user, existing.sites.map((s) => s.id))) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // MANAGER/CLEANER can only mutate schedules linked to exactly their own site.
    // OP/DIRECTOR can mutate any schedule.
    if (!canMutateSchedule(auth.user, existing)) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    const body = await req.json()

    const updateData: Record<string, unknown> = {}

    // Only update fields that exist in the schema
    if (body.title !== undefined) updateData.title = String(body.title).slice(0, 500)
    // Allow editing suggestedFrequency to correct AI mistakes
    if (body.suggestedFrequency !== undefined) updateData.suggestedFrequency = body.suggestedFrequency
    // Note: detectedFrequency stays read-only as a record of what AI originally detected

    const schedule = await prisma.schedule.update({
      where: { id },
      data: updateData,
      include: {
        sites: { where: visibleSiteRelationWhere(auth.user), select: { id: true, name: true } },
        tasks: true
      }
    })

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('Error updating schedule:', error)
    return NextResponse.json(
      { error: 'Failed to update schedule' },
      { status: 500 }
    )
  }
}

// Delete a schedule
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const params = await context.params
    const { id } = params

    const existing = await prisma.schedule.findUnique({
      where: { id },
      select: { sites: { select: { id: true } } }
    })
    if (!existing || !canAccessAnySite(auth.user, existing.sites.map((s) => s.id))) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // MANAGER/CLEANER can only mutate schedules linked to exactly their own site.
    // OP/DIRECTOR can mutate any schedule.
    if (!canMutateSchedule(auth.user, existing)) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Delete through a guarded predicate rather than by id alone. The check above reads
    // the site links in a separate statement, so a concurrent relink could otherwise let
    // a MANAGER's delete land on a schedule that has just become shared. Repeating the
    // "linked to exactly my site" condition in the delete itself closes that window.
    const deleted = await prisma.schedule.deleteMany({
      where: canAccessAllSites(auth.user.role)
        ? { id }
        : {
            id,
            sites: {
              every: { id: auth.user.siteId ?? '' },
              some: { id: auth.user.siteId ?? '' },
            },
          },
    })

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting schedule:', error)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to delete schedule' },
      { status: 500 }
    )
  }
}
