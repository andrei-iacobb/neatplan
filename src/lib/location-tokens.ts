import 'server-only'

import { createHmac, hkdfSync, timingSafeEqual } from 'crypto'

/**
 * Signed location tokens for QR labels and NFC tags.
 *
 * WHAT THESE ARE
 *
 * A token identifies a room or a piece of equipment and says "this label was
 * issued by us, and it has not been revoked". That is all. It is a convenience:
 * it saves a cleaner scrolling a list of sixty rooms to find the one they are
 * standing in.
 *
 * WHAT THESE ARE NOT
 *
 * A static QR code or NFC tag is NOT proof of physical presence. The code is
 * printed on a sticker; anyone who has photographed it, or copied the URL out of
 * their history, can replay it from anywhere. Cloning an NFC tag costs a few
 * pounds. Nothing here should ever be treated as attendance evidence, and the
 * all-required-tasks sign-off is unchanged by it: a scan annotates HOW a room was
 * identified, never WHETHER the work may be signed off.
 *
 * DESIGN
 *
 * The token is a signed statement rather than a stored secret. That means no
 * table of live label tokens to keep, and no write on the read path. Revocation
 * works by bumping the target's `locationTokenVersion`: every label printed
 * against the old version stops verifying at once, which is exactly what you want
 * when a sticker walks off with an agency cleaner.
 */

export type LocationKind = 'room' | 'equipment'

const KIND_CODE: Record<LocationKind, string> = { room: 'r', equipment: 'e' }
const CODE_KIND: Record<string, LocationKind> = { r: 'room', e: 'equipment' }

/**
 * 128 bits of tag. The token is short-lived only in the sense that a version bump
 * kills it; it is not a bearer credential for anything privileged, and the reader
 * still has to be an authenticated user of the right site. 16 bytes is well past
 * what forging one would be worth.
 */
const TAG_BYTES = 16

/**
 * Crockford base32: no I, L, O or U, so a code read off a label and typed by hand
 * cannot be confused between one and I, or zero and O.
 */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const SHORT_CODE_CHARS = 8

let cachedKey: Buffer | null = null

/**
 * A key derived from NEXTAUTH_SECRET rather than the secret itself.
 *
 * Using the session secret directly for a second purpose means a weakness in
 * either use bleeds into the other. HKDF with a purpose label keeps them
 * independent while still requiring only one secret to be configured, which is
 * the difference between this shipping and sitting behind an ops ticket.
 */
function signingKey(): Buffer {
  if (cachedKey) return cachedKey

  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    // Fail closed and loudly. Minting unsigned labels, or verifying against an
    // empty key, would be worse than not having the feature.
    throw new Error('NEXTAUTH_SECRET is required to sign location tokens')
  }

  cachedKey = Buffer.from(
    hkdfSync('sha256', Buffer.from(secret, 'utf8'), Buffer.alloc(0), 'neatplan-location-token-v1', 32)
  )
  return cachedKey
}

/** Exposed for tests that swap the environment. */
export function resetLocationTokenKeyCache(): void {
  cachedKey = null
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64url')
}

/** The signed statement, before encoding. Kept short so the QR stays low-density. */
function body(kind: LocationKind, id: string, version: number): string {
  return `${KIND_CODE[kind]}.${id}.${version}`
}

function tag(statement: string): Buffer {
  return createHmac('sha256', signingKey()).update(statement).digest().subarray(0, TAG_BYTES)
}

/**
 * Mint the token that goes into a label's QR code and NFC payload.
 *
 * `version` must be the target's CURRENT `locationTokenVersion`. Minting against
 * a stale version produces a label that is already dead.
 */
export function mintLocationToken(kind: LocationKind, id: string, version: number): string {
  if (!id || id.includes('.')) {
    // Ids are cuids; a dot would make the statement ambiguous to parse back.
    throw new Error('Location token id must be a non-empty value containing no dot')
  }
  const statement = body(kind, id, version)
  return `${base64url(Buffer.from(statement, 'utf8'))}.${base64url(tag(statement))}`
}

export interface LocationTokenClaims {
  kind: LocationKind
  id: string
  version: number
}

/**
 * Verify and decode a token. Returns null for anything that does not verify -
 * there is deliberately no distinction between "malformed", "wrong signature" and
 * "unknown kind", because a scanner has no business learning which.
 *
 * Verifying the signature does NOT authorise anything. The caller still has to
 * load the target, check the reader may see that site, and check the version is
 * current.
 */
export function parseLocationToken(token: string | null | undefined): LocationTokenClaims | null {
  if (!token || typeof token !== 'string') return null

  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [encodedStatement, encodedTag] = parts

  let statement: string
  let presented: Buffer
  try {
    statement = Buffer.from(encodedStatement, 'base64url').toString('utf8')
    presented = Buffer.from(encodedTag, 'base64url')
  } catch {
    return null
  }

  if (presented.length !== TAG_BYTES) return null

  const expected = tag(statement)
  // Constant time: a byte-at-a-time comparison would leak how much of a forged
  // tag was correct, which is enough to build one a byte at a time.
  if (!timingSafeEqual(expected, presented)) return null

  const fields = statement.split('.')
  if (fields.length !== 3) return null

  const [kindCode, id, rawVersion] = fields
  const kind = CODE_KIND[kindCode]
  if (!kind || !id) return null

  const version = Number(rawVersion)
  if (!Number.isInteger(version) || version < 1) return null

  return { kind, id, version }
}

/**
 * A short code printed on the label in plain text, for when the camera is
 * unavailable, permission is denied, or the sticker is too scuffed to scan.
 *
 * Derived from the same signed statement, so it revokes with the token and needs
 * no column of its own. It is NOT a secret: it is eight characters and is printed
 * on a wall. It only ever narrows down which of the reader's own rooms they mean,
 * and the reader is already authenticated and site-scoped before it is used.
 */
export function locationShortCode(kind: LocationKind, id: string, version: number): string {
  const digest = tag(body(kind, id, version))

  let bits = 0
  let value = 0
  let code = ''
  for (const byte of digest) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      code += CROCKFORD[(value >>> (bits - 5)) & 31]
      bits -= 5
      if (code.length === SHORT_CODE_CHARS) {
        return `${code.slice(0, 4)}-${code.slice(4)}`
      }
    }
  }

  // Unreachable while TAG_BYTES >= 5: eight base32 characters need 40 bits. If
  // the tag is ever shortened, fail rather than returning a half-length code
  // that would print on a label and never match.
  throw new Error('Location digest exhausted before the short code was complete')
}

/**
 * Normalise what somebody typed off a label. Accepts lower case, a missing
 * hyphen, and the transcription slips Crockford base32 is designed around.
 *
 * The rules live in a client-safe module because the search box applies exactly
 * the same ones, and two copies would drift the first time either is touched.
 */
export { normalizeShortCodeClient as normalizeShortCode } from '@/lib/short-code-client'

/**
 * The URL a label points at. Both the QR image and the NFC payload carry exactly
 * this, so a tag written from a label and a scan of the same label land in the
 * same place.
 */
export function locationTokenUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, '')}/c/${token}`
}
