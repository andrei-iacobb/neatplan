import { formatDateTime } from '@/lib/export/format'
import type { LabelModel } from '@/lib/labels'
import { PrintToolbar } from './print-toolbar'

interface LabelSheetProps {
  labels: LabelModel[]
  siteLabel: string
  /** Matching targets before the cap, so the sheet can say what it left out. */
  total: number
  cap: number
  /** Append the NFC writing sheet, which is a separate job from the stickers. */
  showNfc: boolean
  /** Link that flips the NFC section on or off. */
  toggleNfcHref: string
}

function Label({ label }: { label: LabelModel }) {
  const title = `${label.name}${label.place ? `, ${label.place}` : ''}`

  return (
    <div className="lb">
      <div className="lb__qr">
        <svg
          viewBox={`0 0 ${label.qr.size} ${label.qr.size}`}
          role="img"
          aria-label={`QR code for ${title}`}
          // shape-rendering keeps module edges hard instead of anti-aliased into
          // grey, which is what makes a printed code fail to scan.
          shapeRendering="crispEdges"
        >
          <rect width={label.qr.size} height={label.qr.size} fill="#fff" />
          <path d={label.qr.d} fill="#000" />
        </svg>
      </div>

      <div className="lb__body">
        <p className="lb__name">{label.name}</p>
        {label.place ? <p className="lb__place">{label.place}</p> : null}
        <p className="lb__detail">
          {[label.siteName, label.detail].filter(Boolean).join('  ·  ')}
        </p>
        <p className="lb__code">
          <span className="lb__codelabel">Code</span>
          {label.shortCode}
        </p>
      </div>
    </div>
  )
}

/**
 * The addresses to write onto NFC tags, and how to do it.
 *
 * This is deliberately a second, separate sheet: writing tags is a different job
 * from sticking up QR labels, usually done once at a desk rather than walking the
 * building, so it is off by default and does not waste paper on a reprint.
 *
 * No NFC writing hardware has been tested against this. What is provided is the
 * exact payload each tag needs; the writing itself is done with an ordinary phone
 * app, and whoever does it should verify one tag by scanning it before doing the
 * remaining fifty.
 */
function NfcSheet({ labels, siteLabel }: { labels: LabelModel[]; siteLabel: string }) {
  return (
    <article className="pd pd--landscape">
      <header className="pd-head">
        <div>
          <h1 className="pd-head__title">NFC tag addresses</h1>
          <p className="pd-head__subtitle">{siteLabel}</p>
        </div>
        <div className="pd-head__brand">
          <span className="pd-head__brandname">NeatPlan</span>
        </div>
      </header>

      <ol className="pd-steps">
        <li>
          Install an NFC writing app on an NFC-capable phone. NFC Tools works on both Android and
          iPhone and is the one these instructions assume.
        </li>
        <li>
          Choose <strong>Write</strong>, then <strong>Add a record</strong>, then{' '}
          <strong>URL/URI</strong>. Paste the address from the table below.
        </li>
        <li>
          Hold the tag against the back of the phone until the app confirms. Tags are typically
          NTAG213 or better; anything advertised as holding 100 characters or more is enough.
        </li>
        <li>
          Lock the tag read-only if the app offers it, so a tag left on a trolley cannot be
          rewritten to point somewhere else.
        </li>
        <li>
          Scan the first tag with a normal phone camera before writing the rest. It should open
          NeatPlan at the right room. If it does not, nothing below will work either.
        </li>
      </ol>

      <div className="pd-tablewrap">
        <table className="pd-table">
          <thead>
            <tr>
              <th scope="col">Room / equipment</th>
              <th scope="col">Where</th>
              <th scope="col">Code</th>
              <th scope="col">Address to write</th>
            </tr>
          </thead>
          <tbody>
            {labels.map((label) => (
              <tr key={`nfc-${label.kind}-${label.id}`}>
                <td className="pd-identity">{label.name}</td>
                <td>{label.place}</td>
                <td className="pd-mono">{label.shortCode}</td>
                <td className="pd-mono pd-wrap">{label.url}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="pd-foot">
        <span>
          A tag can be copied as easily as a sticker can be photographed, so a scan identifies a
          location and nothing more. Replacing a label from the room or equipment screen makes every
          tag written from this sheet stop working.
        </span>
        <span>
          {labels.length} {labels.length === 1 ? 'address' : 'addresses'}
        </span>
      </footer>
    </article>
  )
}

/**
 * A printable sheet of location labels.
 *
 * Laid out eight to an A4 page in physical units, because these get cut out or
 * stuck to a label sheet and a label that is "about right" on screen is the wrong
 * size on paper.
 */
export function LabelSheet({ labels, siteLabel, total, showNfc, toggleNfcHref }: LabelSheetProps) {
  const exportedAt = formatDateTime(new Date())

  return (
    <div className="pd-shell">
      <PrintToolbar
        csvHref=""
        title="Location labels"
        rowCount={labels.length}
        truncated={total > labels.length}
        hideCsv
      />

      <article className="pd lb-sheet">
        <header className="pd-head">
          <div>
            <h1 className="pd-head__title">Location labels</h1>
            <p className="pd-head__subtitle">{siteLabel}</p>
          </div>
          <div className="pd-head__brand">
            <span className="pd-head__brandname">NeatPlan</span>
            {exportedAt}
          </div>
        </header>

        {total > labels.length ? (
          <p className="pd-notice">
            Showing the first {labels.length} of {total} labels. Filter by floor or site and print
            again for the rest.
          </p>
        ) : null}

        {labels.length === 0 ? (
          <p className="pd-empty">No rooms or equipment matched. Nothing to label.</p>
        ) : (
          <div className="lb-grid">
            {labels.map((label) => (
              <Label key={`${label.kind}-${label.id}`} label={label} />
            ))}
          </div>
        )}

        <footer className="pd-foot">
          <span>
            Scanning identifies the room or item. It is not a record of attendance, and every task
            still has to be signed off.
          </span>
          <span>
            {labels.length} {labels.length === 1 ? 'label' : 'labels'}
          </span>
        </footer>
      </article>

      {showNfc && labels.length > 0 ? <NfcSheet labels={labels} siteLabel={siteLabel} /> : null}

      <div className="pd-nfc-toggle" data-print-hide>
        <a className="pd-btn" href={toggleNfcHref}>
          {showNfc ? 'Hide the NFC writing sheet' : 'Also show the NFC writing sheet'}
        </a>
      </div>

      <div className="pd-runningfoot" aria-hidden="true">
        {`Location labels  ·  ${siteLabel}  ·  Printed ${exportedAt}`}
      </div>
    </div>
  )
}
