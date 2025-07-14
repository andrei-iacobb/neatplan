import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const equipmentSchedules = await prisma.equipmentSchedule.findMany({
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