import { NextResponse } from 'next/server'
import { Prisma } from '@/generated/prisma/client'
import * as z from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, requireRole, canAccessSite } from '@/lib/authz'

const siteSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  address: z.string().optional(),
  description: z.string().optional(),
})

const siteSelect = {
  id: true,
  name: true,
  address: true,
  description: true,
} as const

// GET /api/sites/[id] - any authenticated user, but a site-pinned user may only
// read their own site. Return 404 (not 403) when out of scope to avoid leaking
// which site ids exist.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  try {
    const { id } = await params
    const site = await prisma.site.findUnique({ where: { id }, select: siteSelect })

    if (!site || !canAccessSite(auth.user, site.id)) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }

    return NextResponse.json(site)
  } catch (error) {
    console.error('Error fetching site:', error)
    return NextResponse.json({ error: 'Failed to fetch site' }, { status: 500 })
  }
}

// PUT /api/sites/[id] - update a site. Restricted to Director and OP, both of
// whom span every site, so no per-site check is required.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole('DIRECTOR')
  if ('error' in auth) return auth.error

  try {
    const { id } = await params
    const body = await request.json()
    const { name, address, description } = siteSchema.parse(body)

    const site = await prisma.site.update({
      where: { id },
      data: { name, address, description },
      select: siteSelect,
    })

    return NextResponse.json(site)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid site data', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'A site with this name already exists' },
          { status: 409 }
        )
      }
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Site not found' }, { status: 404 })
      }
    }
    console.error('Error updating site:', error)
    return NextResponse.json({ error: 'Failed to update site' }, { status: 500 })
  }
}

// DELETE /api/sites/[id] - remove a site. Restricted to Director and OP. Schema
// cascades delete rooms/equipment/schedules and nulls the siteId of its users.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole('DIRECTOR')
  if ('error' in auth) return auth.error

  try {
    const { id } = await params
    await prisma.site.delete({ where: { id } })
    return NextResponse.json({ message: 'Site deleted successfully' })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 })
    }
    console.error('Error deleting site:', error)
    return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 })
  }
}
