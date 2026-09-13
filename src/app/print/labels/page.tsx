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
 * NEXTAUTH_URL first. It is a required, validated environment variable and is
 * already what the app treats as its canonical public address for sign-in
 * redirects, so a label that agrees with it agrees with the rest of the app. A
 * label is a physical object that outlives the request that printed it, which is
 * exactly when guessing from the request host goes wrong: print from a LAN
 * address and every sticker points somewhere nobody outside the building can
 * reach.
 *
 * The forwarded headers are the fallback for a deployment that has not set it.
 * The protocol is only assumed to be https for a non-local host - assuming it
 * unconditionally produces labels that cannot be opened over plain HTTP.
 */
async function requestOrigin(): Promise<string> {
  const configured = process.env.NEXTAUTH_URL?.trim()
  if (configured) return configured.replace(/\/+$/, '')

  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  if (!host) return ''

  const forwardedProto = headerList.get('x-forwarded-proto')
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
  const proto = forwardedProto ?? (isLocal ? 'http' : 'https')

  return `${proto}://${host}`
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
