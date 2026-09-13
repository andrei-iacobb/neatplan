import { describe, it, expect, beforeEach, afterAll } from 'vitest'

const ORIGINAL_SECRET = process.env.NEXTAUTH_SECRET

const {
  mintLocationToken,
  parseLocationToken,
  locationShortCode,
  normalizeShortCode,
  locationTokenUrl,
  resetLocationTokenKeyCache,
} = await import('@/lib/location-tokens')

function withSecret(secret: string) {
  process.env.NEXTAUTH_SECRET = secret
  resetLocationTokenKeyCache()
}

beforeEach(() => withSecret('a-test-secret-long-enough-for-hkdf-derivation'))

afterAll(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.NEXTAUTH_SECRET
  else process.env.NEXTAUTH_SECRET = ORIGINAL_SECRET
  resetLocationTokenKeyCache()
})

describe('minting and verifying', () => {
  it('round-trips the claims a label carries', () => {
    const token = mintLocationToken('room', 'cm_room_1', 3)
    expect(parseLocationToken(token)).toEqual({ kind: 'room', id: 'cm_room_1', version: 3 })
  })

  it('distinguishes a room from equipment with the same id', () => {
    const room = mintLocationToken('room', 'shared_id', 1)
    const equipment = mintLocationToken('equipment', 'shared_id', 1)

    expect(room).not.toBe(equipment)
    expect(parseLocationToken(room)?.kind).toBe('room')
    expect(parseLocationToken(equipment)?.kind).toBe('equipment')
  })

  it('rejects a token whose payload was edited to point at another room', () => {
    // The attack this exists to stop: take a label you legitimately hold, swap
    // the id inside it, and walk into a room you were never issued one for.
    const token = mintLocationToken('room', 'room_a', 1)
    const [payload, signature] = token.split('.')
    const decoded = Buffer.from(payload, 'base64url').toString('utf8')
    const forgedPayload = Buffer.from(decoded.replace('room_a', 'room_b'), 'utf8').toString('base64url')

    expect(parseLocationToken(`${forgedPayload}.${signature}`)).toBeNull()
  })

  it('rejects a token whose version was edited to dodge a revocation', () => {
    const token = mintLocationToken('room', 'room_a', 1)
    const [payload, signature] = token.split('.')
    const decoded = Buffer.from(payload, 'base64url').toString('utf8')
    const bumped = Buffer.from(decoded.replace(/\.1$/, '.9'), 'utf8').toString('base64url')

    expect(parseLocationToken(`${bumped}.${signature}`)).toBeNull()
  })

  it('rejects a tampered signature', () => {
    const token = mintLocationToken('room', 'room_a', 1)
    const [payload, signature] = token.split('.')
    const flipped = signature.slice(0, -1) + (signature.endsWith('A') ? 'B' : 'A')

    expect(parseLocationToken(`${payload}.${flipped}`)).toBeNull()
  })

  it('rejects a token minted under a different secret', () => {
    const token = mintLocationToken('room', 'room_a', 1)
    withSecret('a-completely-different-secret-value-here')

    expect(parseLocationToken(token)).toBeNull()
  })

  it('rejects malformed input without throwing', () => {
    for (const bad of [
      null,
      undefined,
      '',
      'nonsense',
      'only.two.parts.here',
      'a.b',
      '.',
      Buffer.from('r.room.1').toString('base64url'),
    ]) {
      expect(parseLocationToken(bad as string)).toBeNull()
    }
  })

  it('rejects a signature of the wrong length', () => {
    const token = mintLocationToken('room', 'room_a', 1)
    const [payload] = token.split('.')
    expect(parseLocationToken(`${payload}.${Buffer.from('short').toString('base64url')}`)).toBeNull()
  })

  it('rejects an unknown kind code', () => {
    const token = mintLocationToken('room', 'room_a', 1)
    const [, signature] = token.split('.')
    const otherKind = Buffer.from('x.room_a.1', 'utf8').toString('base64url')
    expect(parseLocationToken(`${otherKind}.${signature}`)).toBeNull()
  })

  it('rejects a non-integer or zero version', () => {
    const [, signature] = mintLocationToken('room', 'room_a', 1).split('.')
    for (const version of ['0', '-1', 'abc', '1.5']) {
      const payload = Buffer.from(`r.room_a.${version}`, 'utf8').toString('base64url')
      expect(parseLocationToken(`${payload}.${signature}`)).toBeNull()
    }
  })

  it('refuses to mint without a secret rather than signing with an empty key', () => {
    delete process.env.NEXTAUTH_SECRET
    resetLocationTokenKeyCache()

    expect(() => mintLocationToken('room', 'room_a', 1)).toThrow(/NEXTAUTH_SECRET/)
  })

  it('refuses an id containing the field separator', () => {
    expect(() => mintLocationToken('room', 'has.a.dot', 1)).toThrow()
  })

  it('stays short enough to keep the QR scannable', () => {
    // A cuid is 25 characters. Past roughly 120 the encoder needs a denser
    // version, and density is what makes a scan fail on a tablet camera.
    const token = mintLocationToken('room', 'clh3kxy9a0000qzrmn831i7rn', 1)
    expect(token.length).toBeLessThan(120)
  })
})

describe('revocation', () => {
  it('invalidates every prior label when the version moves', () => {
    const printed = mintLocationToken('room', 'room_a', 1)
    expect(parseLocationToken(printed)).not.toBeNull()

    // The token still verifies as a signed statement - it is the CALLER that has
    // to compare the version against the room's current one. That comparison is
    // what revocation is, and it is asserted in the route tests.
    expect(parseLocationToken(printed)?.version).toBe(1)
    expect(parseLocationToken(mintLocationToken('room', 'room_a', 2))?.version).toBe(2)
  })
})

describe('short codes', () => {
  it('is stable for the same target and version', () => {
    expect(locationShortCode('room', 'room_a', 1)).toBe(locationShortCode('room', 'room_a', 1))
  })

  it('changes when the label is replaced', () => {
    expect(locationShortCode('room', 'room_a', 1)).not.toBe(locationShortCode('room', 'room_a', 2))
  })

  it('differs between two rooms', () => {
    expect(locationShortCode('room', 'room_a', 1)).not.toBe(locationShortCode('room', 'room_b', 1))
  })

  it('is printed in a form a person can read back', () => {
    const code = locationShortCode('room', 'room_a', 1)
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/)
    // Crockford base32 drops I, L, O and U precisely so these cannot appear.
    expect(code).not.toMatch(/[ILOU]/)
  })

  it('accepts the ways somebody might type it off a wall', () => {
    const code = locationShortCode('room', 'room_a', 1)
    const bare = code.replace('-', '')

    expect(normalizeShortCode(code)).toBe(code)
    expect(normalizeShortCode(bare)).toBe(code)
    expect(normalizeShortCode(bare.toLowerCase())).toBe(code)
    expect(normalizeShortCode(` ${bare} `)).toBe(code)
  })

  it('folds the characters people confuse when copying', () => {
    expect(normalizeShortCode('I2345678')).toBe(normalizeShortCode('12345678'))
    expect(normalizeShortCode('L2345678')).toBe(normalizeShortCode('12345678'))
    expect(normalizeShortCode('O2345678')).toBe(normalizeShortCode('02345678'))
    expect(normalizeShortCode('U2345678')).toBe(normalizeShortCode('V2345678'))
  })

  it('rejects the wrong length instead of guessing', () => {
    expect(normalizeShortCode('ABC')).toBeNull()
    expect(normalizeShortCode('ABCD-EFGHI')).toBeNull()
    expect(normalizeShortCode('')).toBeNull()
    expect(normalizeShortCode(null)).toBeNull()
  })
})

describe('label urls', () => {
  it('builds the address written to both the QR and the NFC tag', () => {
    const token = mintLocationToken('room', 'room_a', 1)
    expect(locationTokenUrl('https://neatplan.example', token)).toBe(
      `https://neatplan.example/c/${token}`
    )
  })

  it('does not double a slash when the origin carries one', () => {
    const token = mintLocationToken('room', 'room_a', 1)
    expect(locationTokenUrl('https://neatplan.example/', token)).not.toContain('//c/')
  })
})
