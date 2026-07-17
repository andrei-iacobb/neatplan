import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin, canAccessSite } from '@/lib/authz'

export async function PUT(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const params = await context.params
    const { taskId } = params
    const { roomId } = await request.json()

    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      )
    }

    // The task must belong to a site this user can access.
    const task = await prisma.cleaningTask.findUnique({
      where: { id: taskId },
      select: { siteId: true }
    })

    if (!task || !canAccessSite(auth.user, task.siteId)) {
      return NextResponse.json(
        { error: 'Cleaning task not found' },
        { status: 404 }
      )
    }

    // Verify room exists and is accessible to this user
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    })

    if (!room || !canAccessSite(auth.user, room.siteId)) {
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
