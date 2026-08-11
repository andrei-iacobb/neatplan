import { NextResponse } from 'next/server'
import { requireAuth, requireAdmin, siteScopeWhere, resolveWriteSiteId, canAccessSite } from '@/lib/authz'
import { prisma } from '@/lib/db'
import { Prisma } from '@/generated/prisma/client'

export async function GET() {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error

    const tasks = await prisma.cleaningTask.findMany({
      where: siteScopeWhere(auth.user),
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
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const body = await request.json()
    const { taskDescription, frequency, estimatedDuration, roomId } = body

    if (!taskDescription?.trim() || !frequency?.trim() || !estimatedDuration?.trim()) {
      return NextResponse.json(
        { error: 'taskDescription, frequency, and estimatedDuration are required' },
        { status: 400 }
      )
    }

    // Determine the site to stamp on the task. When it targets a room, the task
    // belongs to that room's site (and the room must be accessible); otherwise
    // fall back to the requested/own site.
    let siteId = resolveWriteSiteId(auth.user, body.siteId)
    if (roomId) {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { siteId: true }
      })
      if (!room || !canAccessSite(auth.user, room.siteId)) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 })
      }
      siteId = room.siteId
    }

    if (!siteId) {
      return NextResponse.json(
        { error: 'A site is required to create a cleaning task' },
        { status: 400 }
      )
    }

    const task = await prisma.cleaningTask.create({
      data: {
        taskDescription: taskDescription.trim(),
        frequency: frequency.trim(),
        estimatedDuration: estimatedDuration.trim(),
        roomId: roomId || null,
        siteId,
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('Error creating cleaning task:', error)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Error creating cleaning task' },
      { status: 500 }
    )
  }
}
