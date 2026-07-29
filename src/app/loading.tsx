/**
 * Route fallback for the admin overview, painted while the page awaits
 * getServerSession and before any dashboard JS runs.
 *
 * Everything here is INLINE-STYLED on purpose. This is the one fallback that can
 * paint during the very first document render, and on a cold load the stylesheet
 * is not guaranteed to have arrived yet. When it has not, Tailwind classes do
 * nothing, `sr-only` stops hiding its text, and the whole thing renders as naked
 * serif copy. Inline styles always apply, so this looks right whenever CSS lands.
 * The nested route fallbacks are only reached by client navigation, where the
 * stylesheet is long since loaded, so they keep using the shared Skeleton.
 *
 * Shape-matched to DashboardOverview: a 1230px column, a row of four stat tiles,
 * then the bento below them.
 */

// Literal colour rather than a CSS custom property - var() resolves against a
// stylesheet that may not exist yet and would collapse to nothing.
const SURFACE = '#e9ecf1'
const PULSE = 'np-dashboard-skeleton-pulse'

function Block({
  height,
  width,
  radius = 12,
}: {
  height: number
  width?: number | string
  radius?: number
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        height,
        width: width ?? '100%',
        borderRadius: radius,
        background: SURFACE,
        animation: `${PULSE} 2s ease-in-out infinite`,
      }}
    />
  )
}

export default function Loading() {
  return (
    <div
      data-route-skeleton="dashboard"
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard"
      style={{
        maxWidth: 1230,
        margin: '0 auto',
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 17,
        paddingBottom: 17,
      }}
    >
      {/* Keyframes travel with the markup so the pulse works pre-stylesheet, and
          reduced motion is honoured here directly for the same reason. */}
      <style>{`
        @keyframes ${PULSE} { 0%, 100% { opacity: 1 } 50% { opacity: .45 } }
        @media (prefers-reduced-motion: reduce) {
          [data-route-skeleton="dashboard"] * { animation: none !important }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Block height={16} width={150} radius={6} />
          <Block height={28} width={260} radius={6} />
        </div>
        <Block height={16} width={220} radius={6} />
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 11 }}>
        {Array.from({ length: 4 }, (_, i) => (
          <Block key={i} height={63} />
        ))}
      </div>

      {/* Bento */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 13 }}>
        <div style={{ gridColumn: 'span 7' }}><Block height={230} /></div>
        <div style={{ gridColumn: 'span 5' }}><Block height={230} /></div>
        <div style={{ gridColumn: 'span 4' }}><Block height={210} /></div>
        <div style={{ gridColumn: 'span 5' }}><Block height={210} /></div>
        <div style={{ gridColumn: 'span 3' }}><Block height={210} /></div>
      </div>
    </div>
  )
}
