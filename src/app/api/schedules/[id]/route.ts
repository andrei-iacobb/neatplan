import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/db'

// Update a schedule
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title } = await req.json()
    
    const schedule = await prisma.schedule.update({
      where: { id: params.id },
      data: { title },
      include: { tasks: true }
    })

    return NextResponse.json(schedule)
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to update schedule' },
      { status: 500 }
    )
  }
}

// Delete a schedule
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // First check if the schedule exists
    const schedule = await prisma.schedule.findUnique({
      where: { id: params.id }
    })

    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }

    // Delete the schedule and its tasks
    await prisma.schedule.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting schedule:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to delete schedule' },
      { status: 500 }
    )
  }
} 