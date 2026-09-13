import { connection, NextResponse } from 'next/server'
import * as z from 'zod'
import { prisma } from '@/lib/db'
import { requireRole, siteScopeWhere } from '@/lib/authz'

/**
 * Revoke the labels printed for a set of rooms or equipment.
 *
 * Bumping `locationTokenVersion` invalidates every QR and NFC tag already minted
 * for that target, because the version is part of the signed statement. This is
 * the recovery path when a sticker is lost, defaced, photographed, or a tag is
 * cloned - and it is the only thing that makes a printed label revocable at all.
 *
 * There is no undo: the previous version cannot be restored, because restoring it
 * would revive whatever label prompted the revocation. Printing a fresh sheet is
 * the way back.
 */
const revokeSchema = z.object({
  kind: z.enum(['room', 'equipment']),
  // One sheet at a time. A request to revoke thousands is a mistake or a probe.
  ids: z.array(z.string().min(1)).min(1).max(240),
})

export async function POST(request: Request) {
  await connection()

  // Printing and revoking sit together: whoever manages the labels on the wall
  // is the one who notices a damaged one.
  const auth = await requireRole('HEAD_OF_HOUSEKEEPING')
  if ('error' in auth) return auth.error

  let parsed: z.infer<typeof revokeSchema>
  try {
    parsed = revokeSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Choose at least one room or item to relabel' }, { status: 400 })
  }

  const { kind, ids } = parsed
  const unique = Array.from(new Set(ids))

  /*
   * The site scope is part of the WHERE, not a check beforehand. A caller passing
   * an id from another site updates nothing rather than erroring, so the response
   * cannot be used to probe which ids exist elsewhere - it just reports a smaller
   * count than they asked for.
   */
  const where = { AND: [{ id: { in: unique } }, siteScopeWhere(auth.user)] }

  const result =
    kind === 'room'
      ? await prisma.room.updateMany({ where, data: { locationTokenVersion: { increment: 1 } } })
      : await prisma.equipment.updateMany({ where, data: { locationTokenVersion: { increment: 1 } } })

  return NextResponse.json({
    revoked: result.count,
    requested: unique.length,
  })
}
