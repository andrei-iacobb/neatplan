import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const schedules = await prisma.roomSchedule.findMany({
      include: {
        schedule: {
          include: {
            tasks: true
          }
        }
      }
    })

    return NextResponse.json(schedules)
  } catch (error) {
    console.error('Error fetching room schedules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch room schedules' },
      { status: 500 }
    )
  }
} 