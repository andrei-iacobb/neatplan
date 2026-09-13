import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/authz'
import { allocationInput } from '@/lib/work-assignments/policy'
import { AssignmentError, loadAssignmentBoard, saveAssignment } from '@/lib/work-assignments/server'

export async function GET(request: Request) {
  const auth = await requireRole('CLEANER')
  if ('error' in auth) return auth.error
  try {
    return NextResponse.json(
      await loadAssignmentBoard(auth.user, new URL(request.url).searchParams),
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid calendar date')
      return NextResponse.json({ error: error.message }, { status: 400 })
    console.error('Failed to load allocations', error)
    return NextResponse.json({ error: 'Could not load allocations' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const auth = await requireRole('HEAD_OF_HOUSEKEEPING')
  if ('error' in auth) return auth.error
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = allocationInput.safeParse(body)
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Invalid allocation', details: parsed.error.issues },
      { status: 400 },
    )
  try {
    return NextResponse.json(await saveAssignment(auth.user, parsed.data))
  } catch (error) {
    if (error instanceof AssignmentError)
      return NextResponse.json({ error: error.message }, { status: error.status })
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      ['P2002', 'P2034', 'P2025'].includes(String(error.code))
    )
      return NextResponse.json(
        { error: 'This allocation changed. Reload before saving again.' },
        { status: 409 },
      )
    console.error('Failed to save allocation', error)
    return NextResponse.json({ error: 'Could not save allocation' }, { status: 500 })
  }
}
