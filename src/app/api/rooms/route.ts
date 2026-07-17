import { NextResponse } from 'next/server'
import { requireAuth, requireAdmin, siteScopeWhere, resolveWriteSiteId } from '@/lib/authz'
import { prisma } from '@/lib/db'
import { Prisma, RoomType } from '@prisma/client'
import * as z from 'zod'

const roomSchema = z.object({
  name: z.string().min(1, 'Room name is required'),
  description: z.string().optional(),
  floor: z.string().optional(),
  type: z.enum(['OFFICE', 'MEETING_ROOM', 'BATHROOM', 'KITCHEN', 'LOBBY', 'STORAGE', 'BEDROOM', 'LOUNGE', 'OTHER']),
  siteId: z.string().optional()
})

export async function GET() {
  try {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error

    const rooms = await prisma.room.findMany({
      where: siteScopeWhere(auth.user),
      include: { site: { select: { id: true, name: true } } },
      orderBy: {
        createdAt: 'desc'
      }
    })
    return NextResponse.json(rooms)
  } catch (error) {
    console.error('Error fetching rooms:', error)
    return NextResponse.json(
      { error: 'Error fetching rooms' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return auth.error

    const body = await req.json()
    const { name, description, floor, type, siteId: requestedSiteId } = roomSchema.parse(body)

    const siteId = resolveWriteSiteId(auth.user, requestedSiteId)
    if (!siteId) {
      return NextResponse.json(
        { error: 'A site is required to create a room' },
        { status: 400 }
      )
    }

    const room = await prisma.room.create({
      data: {
        name,
        description,
        floor,
        type: type as RoomType,
        siteId
      }
    })

    return NextResponse.json(room)
  } catch (error) {
    console.error(error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid room data', details: error.errors },
        { status: 400 }
      )
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'A room with this name already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
