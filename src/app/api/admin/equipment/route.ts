import { NextResponse } from 'next/server'
import { getSessionUser, siteScopeWhere, resolveWriteSiteId, resolveReadSiteId, readSiteWhere } from '@/lib/authz'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const user = await getSessionUser()

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }
    const requestedSiteId = new URL(request.url).searchParams.get('site')
    const siteId = resolveReadSiteId(user, requestedSiteId)

    const equipment = await prisma.equipment.findMany({
      where: {
        AND: [
          siteScopeWhere(user),
          readSiteWhere(siteId),
        ],
      },
      include: {
        site: { select: { id: true, name: true } },
        schedules: {
          include: {
            schedule: {
              include: {
                tasks: true
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Transform equipment data to include summary stats
    const transformedEquipment = equipment.map(equip => {
      const activeSchedules = equip.schedules || []
      const totalTasks = activeSchedules.reduce((acc, schedule) => 
        acc + (schedule.schedule.tasks?.length || 0), 0
      )

      return {
        id: equip.id,
        name: equip.name,
        description: equip.description,
        type: equip.type,
        assetCode: equip.assetCode,
        model: equip.model,
        serialNumber: equip.serialNumber,
        siteId: equip.siteId,
        site: equip.site,
        createdAt: equip.createdAt,
        updatedAt: equip.updatedAt,
        scheduleCount: activeSchedules.length,
        totalTasks,
        schedules: activeSchedules.map(equipmentSchedule => ({
          id: equipmentSchedule.id,
          title: equipmentSchedule.schedule.title,
          frequency: equipmentSchedule.frequency,
          nextDue: equipmentSchedule.nextDue,
          status: equipmentSchedule.status,
          tasksCount: equipmentSchedule.schedule.tasks?.length || 0
        }))
      }
    })

    return NextResponse.json({
      equipment: transformedEquipment,
      total: transformedEquipment.length
    })

  } catch (error) {
    console.error('Error fetching equipment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch equipment' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser()

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      name,
      description,
      type,
      assetCode,
      model,
      serialNumber
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Equipment name is required' },
        { status: 400 }
      )
    }

    const siteId = resolveWriteSiteId(user, body.siteId)
    if (!siteId) {
      return NextResponse.json(
        { error: 'A site is required to create equipment' },
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

    // Trim optional fields and treat empty strings as null
    const trimmedAssetCode = assetCode?.trim() || null
    const trimmedModel = model?.trim() || null
    const trimmedSerialNumber = serialNumber?.trim() || null

    const equipment = await prisma.equipment.create({
      data: {
        name,
        description,
        type: type || 'OTHER',
        siteId,
        assetCode: trimmedAssetCode,
        model: trimmedModel,
        serialNumber: trimmedSerialNumber,
      }
    })

    return NextResponse.json(equipment, { status: 201 })

  } catch (error: any) {
    console.error('Error creating equipment:', error)
    
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
    
    return NextResponse.json(
      { error: 'Failed to create equipment' },
      { status: 500 }
    )
  }
}
