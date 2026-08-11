import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { runScheduleCheck } from '@/lib/schedule-check'
import { logger } from '@/lib/logger'

function safeSecretMatch(provided: string | null, expected: string | undefined): boolean {
  if (!expected || !provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  // Read request state outside the application catch. Next uses this access to
  // stop prerendering; catching that internal signal would turn it into a 500.
  const providedSecret = request.headers.get('x-cron-secret')
  const expectedSecret = process.env.CRON_SECRET

  try {
    // Protect cron route: require shared secret via header only, compared in constant time.
    if (!safeSecretMatch(providedSecret, expectedSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await runScheduleCheck()

    return NextResponse.json({
      message: `Updated ${result.roomCount} overdue room schedules and ${result.equipmentCount} overdue equipment schedules`,
      ...result,
    })
  } catch (error) {
    logger.error('Error checking schedules', error)
    return NextResponse.json(
      { error: 'Failed to check schedules' },
      { status: 500 }
    )
  }
}
