import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getSessionUser } from '@/lib/authz'
import { resolveDataset } from '@/lib/export/registry'
import { PrintDocument } from '@/components/export/print-document'

type SearchParams = Record<string, string | string[] | undefined>

function toSearchParams(input: SearchParams): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') params.set(key, value)
    else if (Array.isArray(value) && value.length > 0) params.set(key, value[0])
  }
  return params
}

export async function generateMetadata({ params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params
  const { DATASETS } = await import('@/lib/export/registry')
  return { title: DATASETS[dataset]?.title ?? 'Print' }
}

/*
 * `connection()` at the top of the body is what makes this route request-time.
 * The `dynamic` segment config that would normally say so is rejected when
 * cacheComponents is enabled (next.config.js), and a document rendered from the
 * caller's own session must never be prerendered into a shared static shell.
 */
export default async function PrintDatasetPage({
  params,
  searchParams,
}: {
  params: Promise<{ dataset: string }>
  searchParams: Promise<SearchParams>
}) {
  await connection()

  const [{ dataset: datasetId }, rawSearch] = await Promise.all([params, searchParams])

  const user = await getSessionUser()
  if (!user) {
    // Send them through the normal sign-in and back to this exact document,
    // filters intact. The path is rebuilt from the encoded route segment rather
    // than interpolated raw, so the callbackUrl can only ever be a same-origin
    // /print path even if something downstream later decodes it before checking.
    const target = `/print/${encodeURIComponent(datasetId)}?${toSearchParams(rawSearch).toString()}`
    redirect(`/auth?callbackUrl=${encodeURIComponent(target)}`)
  }

  const search = toSearchParams(rawSearch)
  const result = await resolveDataset(datasetId, user, search)

  if (!result.ok) {
    if (result.failure.kind === 'not-found') notFound()
    return (
      <div className="pd-shell">
        <article className="pd">
          <header className="pd-head">
            <div>
              <h1 className="pd-head__title">Not available to you</h1>
              <p className="pd-head__subtitle">
                Your role does not cover this document. Ask a manager if you need it.
              </p>
            </div>
            <div className="pd-head__brand">
              <span className="pd-head__brandname">NeatPlan</span>
            </div>
          </header>
        </article>
      </div>
    )
  }

  const csvHref = `/api/export/${datasetId}?${search.toString()}`

  return <PrintDocument dataset={result.dataset} csvHref={csvHref} />
}
