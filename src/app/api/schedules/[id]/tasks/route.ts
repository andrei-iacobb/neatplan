import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/authz'

// Add a task to a schedule
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const { description, frequency, additionalNotes } = await req.json()

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      )
    }

    const task = await prisma.scheduleTask.create({
      data: {
        description: String(description).slice(0, 1000),
        frequency: frequency ? String(frequency).slice(0, 100) : null,
        additionalNotes: additionalNotes ? String(additionalNotes).slice(0, 2000) : null,
        scheduleId: params.id
      }
    })

    return NextResponse.json(task)
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    )
  }
}
