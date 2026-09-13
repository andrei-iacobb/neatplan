import { todayAssignmentDate } from '@/lib/work-assignments/policy'
import { NextResponse } from 'next/server'
import { getSessionUser, canAccessSite } from '@/lib/authz'
import { prisma } from '@/lib/db'
import { findServiceAreaAtSite, normalizeServiceAreaId } from '@/lib/service-areas'
import { removeEquipmentPhotoDirectory } from '@/lib/equipment-photos'

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

    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        schedules: {
          include: {
            schedule: {
              include: {
                tasks: true
              }
            }
          }
        }
      }
    })

    if (!equipment || !canAccessSite(user, equipment.siteId)) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(equipment)

  } catch (error) {
    console.error('Error fetching equipment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch equipment' },
      { status: 500 }
    )
  }
}

export async function PUT(
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

    const existing = await prisma.equipment.findUnique({
      where: { id },
      select: { siteId: true, serviceAreaId: true },
    })
    if (!existing || !canAccessSite(user, existing.siteId)) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const {
      name,
      description,
      type,
      siteId,
      assetCode,
      model,
      serialNumber,
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Equipment name is required' },
        { status: 400 }
      )
    }

    // Moving equipment to another site is only allowed if the actor can reach it.
    if (siteId !== undefined && siteId !== existing.siteId && !canAccessSite(user, siteId)) {
      return NextResponse.json({ error: 'You cannot move equipment to that site' }, { status: 403 })
    }

    const targetSiteId = siteId !== undefined ? siteId : existing.siteId
    if (!targetSiteId) {
      return NextResponse.json({ error: 'Equipment must belong to a site' }, { status: 400 })
    }
    const normalizedServiceAreaId = normalizeServiceAreaId(body.serviceAreaId)
    if (body.serviceAreaId !== undefined && normalizedServiceAreaId === undefined) {
      return NextResponse.json({ error: 'Service area is invalid' }, { status: 400 })
    }
    // Moving an item to another site unassigns its old cupboard unless the caller
    // explicitly chooses a valid service area at the destination.
    const targetServiceAreaId = normalizedServiceAreaId === undefined
      ? (targetSiteId === existing.siteId ? existing.serviceAreaId : null)
      : normalizedServiceAreaId
    if (targetServiceAreaId && !(await findServiceAreaAtSite(targetServiceAreaId, targetSiteId))) {
      return NextResponse.json(
        { error: 'Choose a service area from the same site as this equipment' },
        { status: 400 }
      )
    }

    for (const [field, value] of Object.entries({ assetCode, model, serialNumber })) {
      if (value !== undefined && value !== null && typeof value !== 'string') {
        return NextResponse.json({ error: `${field} must be a string` }, { status: 400 })
      }
      if (typeof value === 'string' && value.length > 200) {
        return NextResponse.json({ error: `${field} must be 200 characters or fewer` }, { status: 400 })
      }
    }

    // Trim to null when submitted empty; leave undefined (= not submitted) untouched.
    const normalize = (value: string | null | undefined) =>
      value === undefined ? undefined : (value?.trim() || null)

    const equipment = await prisma.equipment.update({
      where: { id },
      data: {
        name,
        description,
        type: type || 'OTHER',
        ...(siteId !== undefined ? { siteId } : {}),
        assetCode: normalize(assetCode),
        model: normalize(model),
        serialNumber: normalize(serialNumber),
        serviceAreaId: targetServiceAreaId,
        ...(targetSiteId !== existing.siteId ? {
          workAssignments: {
            updateMany: {
              where: { workDate: { gte: todayAssignmentDate() } },
              data: {
                ...(targetSiteId ? { siteId: targetSiteId } : {}),
                assigneeId: null,
                assigneeName: null,
                revision: { increment: 1 },
              },
            },
          },
        } : {}),
      }
    })

    return NextResponse.json(equipment)

  } catch (error: any) {
    console.error('Error updating equipment:', error)
    
    if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
      return NextResponse.json(
        { error: 'Equipment with this name already exists' },
        { status: 409 }
      )
    }

    if (error.code === 'P2002' && error.meta?.target?.includes('assetCode')) {
      return NextResponse.json(
        { error: 'Asset code already in use at this site' },
        { status: 409 }
      )
    }
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update equipment' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Check if equipment exists and has schedules
    const equipment = await prisma.equipment.findUnique({
      where: { id },
      include: {
        schedules: true
      }
    })

    if (!equipment || !canAccessSite(user, equipment.siteId)) {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }

    // Delete equipment (schedules and photo rows will be cascade deleted)
    await prisma.equipment.delete({
      where: { id }
    })

    // The database cascade removes the photo ROWS; the files live on the data
    // volume, which the application owns. Without this they accumulate forever
    // with nothing left referencing them.
    await removeEquipmentPhotoDirectory(id)

    return NextResponse.json({ 
      message: 'Equipment deleted successfully',
      deletedSchedules: equipment.schedules.length 
    })

  } catch (error: any) {
    console.error('Error deleting equipment:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Equipment not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to delete equipment' },
      { status: 500 }
    )
  }
}
