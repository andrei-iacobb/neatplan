import { NextResponse } from 'next/server'
import { requireAuth, requireAdmin, canAccessSite } from '@/lib/authz'
import { prisma } from '@/lib/db'
import { RoomType } from '@/generated/prisma/enums'
import * as z from 'zod'
import { NextRequest } from 'next/server'

const roomSchema = z.object({
  name: z.string().min(1, 'Room name is required'),
  description: z.string().optional(),
  floor: z.string().optional(),
  type: z.enum(['OFFICE', 'MEETING_ROOM', 'BATHROOM', 'KITCHEN', 'LOBBY', 'STORAGE', 'BEDROOM', 'LOUNGE', 'OTHER']),
  siteId: z.string().optional()
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error
    const { id } = await params

    const existing = await prisma.room.findUnique({ where: { id }, select: { siteId: true } })
    if (!existing || !canAccessSite(auth.user, existing.siteId)) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, description, floor, type, siteId } = roomSchema.parse(body)

    // Moving a room to another site is only allowed if the actor can reach the
    // target site (managers are pinned, so they can never move a room off-site).
    if (siteId !== undefined && siteId !== existing.siteId && !canAccessSite(auth.user, siteId)) {
      return NextResponse.json({ error: 'You cannot move a room to that site' }, { status: 403 })
    }

    const updatedRoom = await prisma.room.update({
      where: {
        id,
      },
      data: {
        name,
        description,
        floor,
        type: type as RoomType,
        ...(siteId !== undefined ? { siteId } : {}),
      },
    })

    return NextResponse.json(updatedRoom)
  } catch (error) {
    console.error('Error updating room:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid room data', details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to update room' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error
    const { id } = await params

    const existing = await prisma.room.findUnique({ where: { id }, select: { siteId: true } })
    if (!existing || !canAccessSite(auth.user, existing.siteId)) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    await prisma.room.delete({
      where: {
        id,
      },
    })

    return NextResponse.json({ message: 'Room deleted successfully' })
  } catch (error) {
    console.error('Error deleting room:', error)
    return NextResponse.json(
      { error: 'Failed to delete room' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error

    const { id } = await params

    const room = await prisma.room.findUnique({
      where: {
        id
      }
    })

    if (!room || !canAccessSite(auth.user, room.siteId)) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(room)
  } catch (error) {
    console.error('Error fetching room:', error)
    return NextResponse.json(
      { error: 'Failed to fetch room' },
      { status: 500 }
    )
  }
}
