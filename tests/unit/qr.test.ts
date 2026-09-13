import { describe, it, expect, afterEach } from 'vitest'
import jsQR from 'jsqr'
import { qrPathForUrl } from '@/lib/qr'
import { mintLocationToken, locationTokenUrl, resetLocationTokenKeyCache } from '@/lib/location-tokens'
import { labelOrigin } from '@/lib/labels'

process.env.NEXTAUTH_SECRET = 'a-test-secret-long-enough-for-hkdf-derivation'
resetLocationTokenKeyCache()

/**
 * Rasterise the SVG path back into pixels so a real decoder can read it.
 *
 * Asserting that we emitted "a path" proves nothing - a label is only worth
 * printing if a camera can resolve it. This walks the path commands the renderer
 * actually produces, which also catches a run-length bug that a matrix-level
 * check would miss.
 */
function rasterize(d: string, size: number, scale = 4, quiet = 4) {
  const side = (size + quiet * 2) * scale
  const data = new Uint8ClampedArray(side * side * 4).fill(255)

  // Each segment is `M<x> <y>h<w>v1h-<w>z`, one per horizontal run of dark modules.
  for (const [, xs, ys, ws] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    const x0 = Number(xs)
    const y0 = Number(ys)
    const width = Number(ws)

    for (let moduleX = x0; moduleX < x0 + width; moduleX++) {
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const px = (((y0 + quiet) * scale + y) * side + ((moduleX + quiet) * scale + x)) * 4
          data[px] = 0
          data[px + 1] = 0
          data[px + 2] = 0
          data[px + 3] = 255
        }
      }
    }
  }

  return { data, side }
}

function decode(url: string): string | null {
  const { d, size } = qrPathForUrl(url)
  const { data, side } = rasterize(d, size)
  return jsQR(data, side, side)?.data ?? null
}

describe('qrPathForUrl', () => {
  it('produces a code a real decoder reads back exactly', () => {
    const url = 'https://neatplan.example/c/some-token-value'
    expect(decode(url)).toBe(url)
  })

  it('round-trips a genuine label URL, token and all', () => {
    const token = mintLocationToken('room', 'clh3kxy9a0000qzrmn831i7rn', 1)
    const url = locationTokenUrl('https://neatplan.iacob.co.uk', token)

    expect(decode(url)).toBe(url)
  })

  it('round-trips an equipment label', () => {
    const token = mintLocationToken('equipment', 'clh3kxy9a0001qzrmabcd1234', 7)
    const url = locationTokenUrl('https://neatplan.iacob.co.uk', token)

    expect(decode(url)).toBe(url)
  })

  it('survives a long origin without losing data', () => {
    const token = mintLocationToken('room', 'clh3kxy9a0000qzrmn831i7rn', 12)
    const url = locationTokenUrl('https://a-rather-long-site-hostname.example.co.uk', token)

    expect(decode(url)).toBe(url)
  })

  it('keeps the module count low enough to scan from a tablet', () => {
    const token = mintLocationToken('room', 'clh3kxy9a0000qzrmn831i7rn', 1)
    const { size } = qrPathForUrl(locationTokenUrl('https://neatplan.iacob.co.uk', token))

    // Version 10 is 57 modules. Past that the printed modules get finer than a
    // cheap camera resolves at arm's length in corridor lighting.
    expect(size).toBeLessThanOrEqual(57)
  })

  it('emits one run per horizontal span rather than one per module', () => {
    const { d, size } = qrPathForUrl('https://neatplan.example/c/x')
    const runs = [...d.matchAll(/M\d+ \d+h\d+v1h-\d+z/g)].length

    expect(runs).toBeGreaterThan(0)
    // A per-module path would be well over one command per module.
    expect(runs).toBeLessThan(size * size)
  })
})

describe('labelOrigin', () => {
  const original = process.env.NEXTAUTH_URL

  afterEach(() => {
    if (original === undefined) delete process.env.NEXTAUTH_URL
    else process.env.NEXTAUTH_URL = original
  })

  it('uses the configured public address', () => {
    process.env.NEXTAUTH_URL = 'https://neatplan.iacob.co.uk'
    expect(labelOrigin()).toBe('https://neatplan.iacob.co.uk')
  })

  it('strips a path or trailing slash down to the origin', () => {
    process.env.NEXTAUTH_URL = 'https://neatplan.iacob.co.uk/'
    expect(labelOrigin()).toBe('https://neatplan.iacob.co.uk')

    process.env.NEXTAUTH_URL = 'https://neatplan.iacob.co.uk/app/'
    expect(labelOrigin()).toBe('https://neatplan.iacob.co.uk')
  })

  it('accepts plain HTTP, which is every LAN deployment', () => {
    process.env.NEXTAUTH_URL = 'http://192.168.1.9:4040'
    expect(labelOrigin()).toBe('http://192.168.1.9:4040')
  })

  it('refuses rather than guessing when it is not configured', () => {
    // A label is physical and outlives the request that printed it. Guessing the
    // origin from a request header would let anyone who may print a sheet send
    // X-Forwarded-Host and walk away with stickers pointing at their own site.
    delete process.env.NEXTAUTH_URL
    expect(labelOrigin()).toBeNull()

    process.env.NEXTAUTH_URL = '   '
    expect(labelOrigin()).toBeNull()
  })

  it('refuses a value that is not a usable web address', () => {
    for (const bad of ['not-a-url', 'javascript:alert(1)', 'file:///etc/passwd', 'ftp://host']) {
      process.env.NEXTAUTH_URL = bad
      expect(labelOrigin(), bad).toBeNull()
    }
  })
})
