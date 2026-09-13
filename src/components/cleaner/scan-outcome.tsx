import Link from 'next/link'
import { AlertTriangle, ScanLine, Search } from 'lucide-react'

type Outcome = 'unreadable' | 'unknown' | 'revoked'

const COPY: Record<Outcome, { title: string; detail: string }> = {
  unreadable: {
    title: 'That code could not be read',
    detail:
      'The label may be damaged, or the link may have been copied incompletely. Find the room in your list instead, or type the code printed under the QR.',
  },
  unknown: {
    title: 'That label is not one of yours',
    detail:
      'It does not match anything at your site. If you are covering another site today, ask a manager to move you across.',
  },
  revoked: {
    title: 'That label has been replaced',
    detail:
      'A newer label has been printed for this location, so this one no longer works. Ask a manager for the replacement, and find the room in your list in the meantime.',
  },
}

/**
 * What a cleaner sees when a scan does not resolve.
 *
 * Every branch ends with a way to carry on working. A dead end here means
 * somebody standing in a corridor with a tablet and no way to record the clean
 * they just did, which is worse than the scan never having existed.
 */
export function ScanOutcome({ kind, name }: { kind: Outcome; name?: string }) {
  const { title, detail } = COPY[kind]

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-6">
      <div
        className="w-full max-w-md rounded-2xl p-6 text-center"
        style={{
          background: 'rgb(var(--card))',
          border: '1px solid rgb(var(--border) / var(--border-alpha))',
        }}
      >
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: 'rgb(var(--warning) / 0.12)' }}
        >
          {kind === 'unreadable' ? (
            <ScanLine className="h-7 w-7" style={{ color: 'rgb(var(--warning))' }} aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-7 w-7" style={{ color: 'rgb(var(--warning))' }} aria-hidden="true" />
          )}
        </div>

        <h1 className="text-[20px] font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
          {title}
        </h1>
        {name ? (
          <p className="mt-1 text-[14px] font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>
            {name}
          </p>
        ) : null}
        <p className="mt-3 text-[14px] leading-relaxed" style={{ color: 'rgb(var(--text-muted))' }}>
          {detail}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/c"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 active:scale-[0.97] motion-reduce:active:scale-100"
            style={{ background: 'rgb(var(--primary))', color: 'rgb(var(--primary-foreground))' }}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Find it by name or code
          </Link>
          <Link
            href="/clean"
            className="flex min-h-12 items-center justify-center rounded-xl px-4 text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            style={{
              background: 'rgb(var(--surface-raised))',
              color: 'rgb(var(--text-primary))',
              border: '1px solid rgb(var(--control-border) / 0.5)',
            }}
          >
            Back to my work
          </Link>
        </div>
      </div>
    </div>
  )
}
