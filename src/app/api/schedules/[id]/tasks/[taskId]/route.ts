import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin, canAccessAnySite, type SessionUser } from '@/lib/authz'

// Verify the task belongs to the given schedule and that the actor can reach
// one of its sites. Returns a 404 NextResponse when not (no existence leak),
// else null.
async function assertTaskAccess(actor: SessionUser, scheduleId: string, taskId: string) {
  const task = await prisma.scheduleTask.findUnique({
    where: { id: taskId },
    select: { scheduleId: true, schedule: { select: { sites: { select: { id: true } } } } },
  })
  if (
    !task ||
    task.scheduleId !== scheduleId ||
    !canAccessAnySite(actor, task.schedule?.sites.map((s) => s.id) ?? [])
  ) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }
  return null
}

// Update a task
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string; taskId: string }> }
) {
  const params = await context.params
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const denied = await assertTaskAccess(auth.user, params.id, params.taskId)
    if (denied) return denied

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
      { error: 'Failed to update task' },
      { status: 500 }
    )
  }
}

// Delete a task
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string; taskId: string }> }
) {
  const params = await context.params
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const denied = await assertTaskAccess(auth.user, params.id, params.taskId)
    if (denied) return denied

    await prisma.scheduleTask.delete({
      where: { id: params.taskId }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    )
  }
}
