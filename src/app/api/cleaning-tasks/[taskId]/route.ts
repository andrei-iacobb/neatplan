import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin, canAccessSite } from '@/lib/authz'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const params = await context.params
    const { taskId } = params
    const { status } = await request.json()

    if (!status || !['pending', 'in_progress', 'completed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be pending, in_progress, or completed' },
        { status: 400 }
      )
    }

    const existing = await prisma.cleaningTask.findUnique({
      where: { id: taskId },
      select: { siteId: true }
    })
    if (!existing || !canAccessSite(auth.user, existing.siteId)) {
      return NextResponse.json({ error: 'Cleaning task not found' }, { status: 404 })
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
