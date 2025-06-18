import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'

// Update a task
export async function PUT(
  req: Request,
  { params }: { params: { id: string; taskId: string } }
) {
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

    const task = await prisma.scheduleTask.update({
      where: { id: params.taskId },
      data: {
        description,
        frequency,
        additionalNotes
      }
    })

    return NextResponse.json(task)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to update task' },
      { status: 500 }
    )
  }
}

// Delete a task
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.scheduleTask.delete({
      where: { id: params.taskId }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to delete task' },
      { status: 500 }
    )
  }
} 