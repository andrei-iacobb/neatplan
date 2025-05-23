import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'

// Get all schedules
export async function GET() {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schedules = await prisma.schedule.findMany({
      include: {
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
      { error: error?.message || 'Failed to fetch schedules' },
      { status: 500 }
    )
  }
}

// Create a new schedule manually
export async function POST(req: Request) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, tasks } = await req.json()

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    const schedule = await prisma.schedule.create({
      data: {
        title,
        tasks: {
          create: tasks || []
        }
      },
      include: {
        tasks: true
      }
    })

    return NextResponse.json(schedule)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create schedule' },
      { status: 500 }
    )
  }
} 