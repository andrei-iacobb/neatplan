import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'
import { calculateNextDueDate } from '@/lib/schedule-utils'

// GET /api/admin/equipment/[id]/schedules - Get schedules for equipment
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
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
    const session = await getServerSession(authOptions)
    const { id: equipmentId } = await params
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    const { scheduleId, frequency } = await request.json()

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      )
    }

    // Get the schedule to check for suggested frequency
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId }
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
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

    // Check if the schedule is already assigned to the equipment
    const existingSchedule = await prisma.equipmentSchedule.findUnique({
      where: {
        equipmentId_scheduleId: {
          equipmentId,
          scheduleId
        }
      }
    })

    if (existingSchedule) {
      return NextResponse.json(
        { error: 'This schedule is already assigned to this equipment' },
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
    const session = await getServerSession(authOptions)
    const { id: equipmentId } = await params
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
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

    const equipmentSchedule = await prisma.equipmentSchedule.findUnique({
      where: {
        equipmentId_scheduleId: {
          equipmentId,
          scheduleId
        }
      }
    })

    if (!equipmentSchedule) {
      return NextResponse.json(
        { error: 'Equipment schedule not found' },
        { status: 404 }
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
    return NextResponse.json(
      { error: 'Failed to remove schedule from equipment' },
      { status: 500 }
    )
  }
} 