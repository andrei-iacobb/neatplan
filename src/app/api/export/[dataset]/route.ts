import { connection, NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/authz'
import { datasetToCsv } from '@/lib/export/csv'
import { exportFilename } from '@/lib/export/format'
import { resolveDataset } from '@/lib/export/registry'

/**
 * CSV for any registered dataset.
 *
 * The filters in the query string are the same ones the screen uses, and the
 * export applies them to EVERY matching row rather than the page the operator
 * happens to be looking at. Where a dataset's cap is reached the document says
 * so in its header block; nothing is dropped silently.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dataset: string }> }
) {
  await connection()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const { dataset: datasetId } = await params
  const searchParams = new URL(request.url).searchParams

  const result = await resolveDataset(datasetId, auth.user, searchParams)

  if (!result.ok) {
    return result.failure.kind === 'not-found'
      ? NextResponse.json({ error: 'Unknown export' }, { status: 404 })
      : NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const csv = datasetToCsv(result.dataset)
  const filename = exportFilename(result.dataset.slug, 'csv')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // An export is a point-in-time document; a cached copy would quietly
      // hand back yesterday's compliance data.
      'Cache-Control': 'no-store',
    },
  })
}
