import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'

// Add a task to a schedule
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { description, frequency, additionalNotes } = await req.json()

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      )
    }

    const task = await prisma.scheduleTask.create({
      data: {
        description,
        frequency,
        additionalNotes,
        scheduleId: params.id
      }
    })

    return NextResponse.json(task)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create task' },
      { status: 500 }
    )
  }
} 