import { describe, it, expect } from 'vitest'
import { generateTotpSecret } from '@/lib/totp'
import { redact } from '@/lib/logger-test-utils'

describe('totp', () => {
  it('generates secrets', () => {
    const secret = generateTotpSecret()
    expect(secret.length).toBeGreaterThan(10)
  })
})

describe('log redaction', () => {
  it('redacts email addresses', () => {
    expect(redact('Contact admin@neatplan.com please')).toContain('[REDACTED]')
  })
})
