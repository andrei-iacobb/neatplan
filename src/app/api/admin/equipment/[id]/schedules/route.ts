import { NextResponse } from 'next/server'
import { getSessionUser, canAccessSite, canAccessAnySite } from '@/lib/authz'
import { prisma } from '@/lib/db'
import { calculateNextDueDate } from '@/lib/schedule-utils'
import { Prisma } from '@/generated/prisma/client'

// GET /api/admin/equipment/[id]/schedules - Get schedules for equipment
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser()
    const { id } = await params

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    // The parent equipment must belong to a site this user can access.
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      select: { siteId: true }
    })
    if (!equipment || !canAccessSite(user, equipment.siteId)) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    const equipmentSchedules = await prisma.equipmentSchedule.findMany({
      where: { equipmentId: id },
      include: {
        schedule: {
          include: {
            tasks: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(equipmentSchedules)

  } catch (error) {
    console.error('Error fetching equipment schedules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch equipment schedules' },
      { status: 500 }
    )
  }
}

// POST /api/admin/equipment/[id]/schedules - Assign a schedule to equipment
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser()
    const { id: equipmentId } = await params

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    // The parent equipment must belong to a site this user can access.
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: { siteId: true }
    })
    if (!equipment || !canAccessSite(user, equipment.siteId)) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    const { scheduleId, frequency } = await request.json()

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      )
    }

    // Get the schedule (with its sites) to check access and suggested frequency
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: { sites: { select: { id: true } } }
    })

    if (!schedule || !canAccessAnySite(user, schedule.sites.map((s) => s.id))) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    // The schedule must be linked to this equipment's site to be assignable here.
    if (!schedule.sites.some((s) => s.id === equipment.siteId)) {
      return NextResponse.json(
        { error: "This schedule is not available at this equipment's site" },
        { status: 400 }
      )
    }

    // Use provided frequency, or fall back to suggested frequency from AI detection
    const suggestedFrequency = (schedule as any).suggestedFrequency
    const assignedFrequency = frequency || suggestedFrequency

    if (!assignedFrequency) {
      return NextResponse.json(
        { error: 'Frequency is required. No frequency provided and schedule has no suggested frequency.' },
        { status: 400 }
      )
    }

    const nextDueDate = calculateNextDueDate(assignedFrequency)

    const equipmentSchedule = await prisma.equipmentSchedule.create({
      data: {
        equipmentId,
        scheduleId,
        frequency: assignedFrequency,
        nextDue: nextDueDate,
        status: 'PENDING'
      },
      include: {
        schedule: {
          select: {
            id: true,
            title: true,
            tasks: true
          }
        }
      }
    })

    return NextResponse.json(equipmentSchedule)
  } catch (error) {
    console.error('Error assigning schedule to equipment:', error)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Schedule already assigned to this equipment' },
          { status: 409 }
        )
      }
      if (error.code === 'P2003') {
        return NextResponse.json(
          { error: 'Equipment or schedule not found' },
          { status: 404 }
        )
      }
    }
    return NextResponse.json(
      { error: 'Failed to assign schedule to equipment' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/equipment/[id]/schedules/[scheduleId] - Remove a schedule from equipment
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser()
    const { id: equipmentId } = await params

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    // The parent equipment must belong to a site this user can access.
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      select: { siteId: true }
    })
    if (!equipment || !canAccessSite(user, equipment.siteId)) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    const url = new URL(request.url)
    const scheduleId = url.searchParams.get('scheduleId')

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      )
    }

    await prisma.equipmentSchedule.delete({
      where: {
        equipmentId_scheduleId: {
          equipmentId,
          scheduleId
        }
      }
    })

    return NextResponse.json({ message: 'Schedule removed from equipment successfully' })

  } catch (error) {
    console.error('Error removing schedule from equipment:', error)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json(
        { error: 'Equipment schedule not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to remove schedule from equipment' },
      { status: 500 }
    )
  }
}
