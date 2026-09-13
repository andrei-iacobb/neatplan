import { connection, NextResponse } from 'next/server'
import { requireRole, resolveReadSiteId } from '@/lib/authz'
import { buildDigest } from '@/lib/digest/build'
import { renderDigest } from '@/lib/digest/render'

/**
 * See the digest without sending it.
 *
 * Returns the rendered HTML so it can be opened in a browser tab. Nothing is
 * sent, nothing is recorded, and the week is not claimed - running this does not
 * stop the real digest going out on Monday.
 */
export async function GET(request: Request) {
  await connection()

  const auth = await requireRole('HEAD_OF_HOUSEKEEPING')
  if ('error' in auth) return auth.error

  const requested = new URL(request.url).searchParams.get('site')
  // A pinned role previews their own site whatever they ask for; the helper
  // ignores the request for them, exactly as every read does.
  const siteId = resolveReadSiteId(auth.user, requested)

  if (!siteId) {
    return NextResponse.json(
      {
        error:
          'Choose a site to preview. The digest covers one site at a time - a summary of every site at once would not be a digest.',
      },
      { status: 400 }
    )
  }

  const content = await buildDigest({ siteId })
  const rendered = renderDigest(content, process.env.NEXTAUTH_URL?.trim() || null)

  return new NextResponse(rendered.html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
