import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tasks = await prisma.cleaningTask.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Error fetching cleaning tasks:', error)
    return NextResponse.json(
      { error: 'Error fetching cleaning tasks' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(session.user as { isAdmin?: boolean }).isAdmin) {
      return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { taskDescription, frequency, estimatedDuration, roomId } = body

    if (!taskDescription?.trim() || !frequency?.trim() || !estimatedDuration?.trim()) {
      return NextResponse.json(
        { error: 'taskDescription, frequency, and estimatedDuration are required' },
        { status: 400 }
      )
    }

    if (roomId) {
      const room = await prisma.room.findUnique({ where: { id: roomId } })
      if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 })
      }
    }

    const task = await prisma.cleaningTask.create({
      data: {
        taskDescription: taskDescription.trim(),
        frequency: frequency.trim(),
        estimatedDuration: estimatedDuration.trim(),
        roomId: roomId || null,
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('Error creating cleaning task:', error)
    return NextResponse.json(
      { error: 'Error creating cleaning task' },
      { status: 500 }
    )
  }
}
