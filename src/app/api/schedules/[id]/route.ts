import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'
import { Prisma } from '@prisma/client'

// Update a schedule
export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const params = await context.params
    const { id } = params
    const { title } = await req.json()

    const schedule = await prisma.schedule.update({
      where: { id },
      data: { title },
      include: { tasks: true }
    })

    return NextResponse.json(schedule)
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update schedule' },
      { status: 500 }
    )
  }
}

// Partial update a schedule (PATCH method)
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const params = await context.params
    const { id } = params

    const body = await req.json()

    const updateData: Record<string, unknown> = {}

    // Only update fields that exist in the schema
    if (body.title !== undefined) updateData.title = String(body.title).slice(0, 500)
    // Allow editing suggestedFrequency to correct AI mistakes
    if (body.suggestedFrequency !== undefined) updateData.suggestedFrequency = body.suggestedFrequency
    // Note: detectedFrequency stays read-only as a record of what AI originally detected

    const schedule = await prisma.schedule.update({
      where: { id },
      data: updateData,
      include: { tasks: true }
    })

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('Error updating schedule:', error)
    return NextResponse.json(
      { error: 'Failed to update schedule' },
      { status: 500 }
    )
  }
}

// Delete a schedule
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const params = await context.params
    const { id } = params

    // Delete the schedule and its tasks
    await prisma.schedule.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting schedule:', error)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Failed to delete schedule' },
      { status: 500 }
    )
  }
}
