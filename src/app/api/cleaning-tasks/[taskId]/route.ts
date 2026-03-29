import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await context.params
    const { taskId } = params
    const { status } = await request.json()

    if (!status || !['pending', 'in_progress', 'completed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be pending, in_progress, or completed' },
        { status: 400 }
      )
    }

    const updatedTask = await prisma.cleaningTask.update({
      where: { id: taskId },
      data: { status }
    })

    return NextResponse.json(updatedTask)
  } catch (error) {
    console.error('Error updating cleaning task:', error)
    return NextResponse.json(
      { error: 'Error updating cleaning task' },
      { status: 500 }
    )
  }
}
