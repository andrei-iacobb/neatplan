import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Get all schedules
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
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
      { error: 'Failed to fetch schedules' },
      { status: 500 }
    )
  }
}

// Create a new schedule manually
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!(session.user as any).isAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
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
          create: (tasks || []).map((t: any) => ({
            description: String(t.description || '').slice(0, 1000),
            frequency: t.frequency ? String(t.frequency).slice(0, 100) : null,
            additionalNotes: t.additionalNotes ? String(t.additionalNotes).slice(0, 2000) : null,
          }))
        }
      },
      include: {
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