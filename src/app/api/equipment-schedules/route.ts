import { NextResponse } from 'next/server'
import { getSessionUser, nestedSiteScopeWhere } from '@/lib/authz'
import { prisma } from '@/lib/db'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getSessionUser()

    if (!user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const equipmentSchedules = await prisma.equipmentSchedule.findMany({
      where: nestedSiteScopeWhere(user, 'equipment'),
      include: {
        equipment: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        schedule: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: {
        nextDue: 'asc'
      }
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