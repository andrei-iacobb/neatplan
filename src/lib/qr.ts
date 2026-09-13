import qrcode from 'qrcode-generator'

/**
 * QR generation for location labels.
 *
 * The encoder is `qrcode-generator`: zero dependencies, ships its own types, and
 * implements the parts nobody should hand-roll - Reed-Solomon over GF(256), the
 * eight mask patterns and the format/version bits. The alternative, `qrcode`,
 * drags in yargs, pngjs and dijkstrajs to do the same job.
 *
 * What is NOT delegated is the rendering. The library emits an HTML string, and
 * this builds an SVG path from the module matrix instead, so a label renders
 * through React without dangerouslySetInnerHTML and carries its own title.
 */

export interface QrPath {
  /** SVG path data covering every dark module. */
  d: string
  /** Module count per side. The viewBox is this square, so callers scale freely. */
  size: number
}

/**
 * Error correction level.
 *
 * `M` (~15% recoverable) is the right trade here. These labels go on door frames
 * and equipment in a care home: they get wiped down, scuffed and occasionally
 * painted around, so `L` is too fragile. `Q` or `H` would buy more tolerance at
 * the cost of a denser code, and density is what makes a scan fail on a cheap
 * tablet camera in corridor lighting.
 */
const ERROR_CORRECTION = 'M' as const

/**
 * Build the QR for a URL as a single SVG path.
 *
 * Type 0 lets the encoder pick the smallest version that fits, so a short URL
 * produces a low-density code that scans from further away.
 */
export function qrPathForUrl(url: string): QrPath {
  const qr = qrcode(0, ERROR_CORRECTION)
  qr.addData(url)
  qr.make()

  const size = qr.getModuleCount()
  const segments: string[] = []

  for (let row = 0; row < size; row++) {
    let runStart = -1

    for (let column = 0; column <= size; column++) {
      const dark = column < size && qr.isDark(row, column)

      if (dark && runStart === -1) {
        runStart = column
      } else if (!dark && runStart !== -1) {
        // One rect per horizontal run rather than per module. A typical label
        // drops from ~700 path commands to ~150, which matters when a sheet
        // carries eight of them.
        segments.push(`M${runStart} ${row}h${column - runStart}v1h-${column - runStart}z`)
        runStart = -1
      }
    }
  }

  return { d: segments.join(''), size }
}
