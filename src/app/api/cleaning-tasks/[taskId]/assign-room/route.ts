import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PUT(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const params = await context.params
    const { taskId } = params
    const { roomId } = await request.json()

    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      )
    }

    // Verify room exists
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    })

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    // Update task with room assignment
    const updatedTask = await prisma.cleaningTask.update({
      where: { id: taskId },
      data: { roomId }
    })

    return NextResponse.json(updatedTask)
  } catch (error) {
    console.error('Error assigning task to room:', error)
    return NextResponse.json(
      { error: 'Error assigning task to room' },
      { status: 500 }
    )
  }
} 