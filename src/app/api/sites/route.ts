import { NextResponse } from 'next/server'
import { Prisma } from '@/generated/prisma/client'
import * as z from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/authz'
import { canAccessAllSites } from '@/lib/roles'

const siteSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  address: z.string().optional(),
  description: z.string().optional(),
})

// GET /api/sites
// Any authenticated user may list sites (so site dropdowns work everywhere).
// OP/DIRECTOR see every site; MANAGER/CLEANER see only the one they are pinned to.
export async function GET() {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const user = auth.user

  try {
    // A site-pinned user with no site assigned sees nothing (fail closed).
    if (!canAccessAllSites(user.role) && !user.siteId) {
      return NextResponse.json([])
    }

    const where = canAccessAllSites(user.role) ? {} : { id: user.siteId as string }

    const sites = await prisma.site.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        address: true,
        description: true,
        _count: { select: { users: true, rooms: true } },
      },
    })

    return NextResponse.json(sites)
  } catch (error) {
    console.error('Error fetching sites:', error)
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 })
  }
}

// POST /api/sites - create a site. Restricted to Director and OP.
export async function POST(req: Request) {
  const auth = await requireRole('DIRECTOR')
  if ('error' in auth) return auth.error

  try {
    const body = await req.json()
    const { name, address, description } = siteSchema.parse(body)

    const site = await prisma.site.create({
      data: { name, address, description },
      select: { id: true, name: true, address: true, description: true },
    })

    return NextResponse.json(site, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid site data', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A site with this name already exists' },
        { status: 409 }
      )
    }
    console.error('Error creating site:', error)
    return NextResponse.json({ error: 'Failed to create site' }, { status: 500 })
  }
}
