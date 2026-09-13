/**
 * The client half of short-code normalisation.
 *
 * Kept apart from `location-tokens`, which is server-only because it holds the
 * signing key. Only the transcription rules live here - no secret, no derivation,
 * nothing that could mint a code.
 */
export function normalizeShortCodeClient(input: string | null | undefined): string | null {
  if (!input) return null

  const cleaned = input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    // Crockford base32 folds the characters people confuse when copying by hand.
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
    .replace(/U/g, 'V')

  if (cleaned.length !== 8) return null
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`
}
