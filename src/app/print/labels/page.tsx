import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { headers } from 'next/headers'
import { getSessionUser, resolveReadSiteId } from '@/lib/authz'
import { hasMinRole } from '@/lib/roles'
import { buildLabelSet, MAX_LABELS } from '@/lib/labels'
import { LabelSheet } from '@/components/export/label-sheet'
import type { LocationKind } from '@/lib/location-tokens'

export const metadata = {
  title: 'Location labels',
  robots: { index: false, follow: false },
}

type SearchParams = Record<string, string | string[] | undefined>

function one(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  if (Array.isArray(value) && value.length > 0) return value[0].trim() || undefined
  return undefined
}

/**
 * The absolute origin the QR codes should point at.
 *
 * Taken from the request rather than a build-time constant: the app is reached on
 * a LAN address, a tunnel hostname and a public domain depending on the site, and
 * a label pointing at the wrong one is a label nobody can scan. The forwarded
 * headers are set by the reverse proxy in front of the app.
 */
async function requestOrigin(): Promise<string> {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  const proto = headerList.get('x-forwarded-proto') ?? 'https'
  if (host) return `${proto}://${host}`
  return process.env.NEXTAUTH_URL ?? ''
}

export default async function LabelsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection()

  const raw = await searchParams
  const user = await getSessionUser()

  if (!user) {
    const query = new URLSearchParams(
      Object.entries(raw).flatMap(([key, value]) => {
        const single = one(value)
        return single ? [[key, single] as [string, string]] : []
      })
    )
    redirect(`/auth?callbackUrl=${encodeURIComponent(`/print/labels?${query.toString()}`)}`)
  }

  // Printing labels mints tokens for every room in scope, so it sits with the
  // people who manage the site rather than with everyone who can read it.
  if (!hasMinRole(user.role, 'HEAD_OF_HOUSEKEEPING')) {
    return (
      <div className="pd-shell">
        <article className="pd">
          <header className="pd-head">
            <div>
              <h1 className="pd-head__title">Not available to you</h1>
              <p className="pd-head__subtitle">
                Printing location labels is a management task. Ask a manager if you need a
                replacement label.
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

  const requestedKind = one(raw.kind)
  const kind: LocationKind | undefined =
    requestedKind === 'room' || requestedKind === 'equipment' ? requestedKind : undefined

  const ids = one(raw.ids)?.split(',').map((id) => id.trim()).filter(Boolean)

  const { labels, total, siteLabel } = await buildLabelSet({
    user,
    kind,
    siteId: resolveReadSiteId(user, one(raw.site) ?? null),
    ids,
    floor: one(raw.floor),
    origin: await requestOrigin(),
  })

  const showNfc = one(raw.nfc) === '1'

  // Keep every other filter when flipping the NFC sheet on or off.
  const toggle = new URLSearchParams(
    Object.entries(raw).flatMap(([key, value]) => {
      const single = one(value)
      return single && key !== 'nfc' ? [[key, single] as [string, string]] : []
    })
  )
  if (!showNfc) toggle.set('nfc', '1')

  return (
    <LabelSheet
      labels={labels}
      siteLabel={siteLabel}
      total={total}
      cap={MAX_LABELS}
      showNfc={showNfc}
      toggleNfcHref={`/print/labels?${toggle.toString()}`}
    />
  )
}
