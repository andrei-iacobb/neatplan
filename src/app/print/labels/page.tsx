import { redirect } from 'next/navigation'
import { connection } from 'next/server'
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
 * The absolute origin the QR codes point at. Configuration only - never the
 * request.
 *
 * Deriving this from `x-forwarded-host` was the obvious thing and is wrong twice
 * over. A label is a physical object that outlives the request that printed it,
 * so printing from a LAN address would put an unreachable address on every
 * sticker. Worse, the header is attacker-controlled: anyone who may print a sheet
 * could send `X-Forwarded-Host: evil.example` and walk away with a stack of
 * stickers whose QR codes send staff to someone else's login page. The middleware
 * forces sign-in right after a scan, so staff are already trained to expect that
 * prompt - which is exactly what makes it a good phishing setup.
 *
 * NEXTAUTH_URL is the app's canonical public address and is already what sign-in
 * redirects use, so a label that agrees with it agrees with the rest of the app.
 * If it is not configured, this refuses to print rather than guessing, the same
 * way the token signer refuses to sign without a secret.
 */
function labelOrigin(): string | null {
  const configured = process.env.NEXTAUTH_URL?.trim()
  if (!configured) return null

  try {
    const url = new URL(configured)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.origin
  } catch {
    return null
  }
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

  const origin = labelOrigin()
  if (!origin) {
    return (
      <div className="pd-shell">
        <article className="pd">
          <header className="pd-head">
            <div>
              <h1 className="pd-head__title">Labels are not configured yet</h1>
              <p className="pd-head__subtitle">
                NeatPlan does not know its own public address, so it cannot put one on a label.
                Set NEXTAUTH_URL to the address staff use to reach NeatPlan, restart, and print
                again. Printing without it would produce stickers nobody can scan.
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

  const ids = one(raw.ids)?.split(',').map((id) => id.trim()).filter(Boolean)

  const { labels, total, siteLabel } = await buildLabelSet({
    user,
    kind,
    siteId: resolveReadSiteId(user, one(raw.site) ?? null),
    ids,
    floor: one(raw.floor),
    origin,
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
