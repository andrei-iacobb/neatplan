/**
 * Password policy enforcement.
 * Minimum 8 characters, at least one uppercase, one lowercase, one digit, one special character.
 */

const MIN_LENGTH = 8

const rules: { test: RegExp; message: string }[] = [
  { test: /[A-Z]/, message: 'at least one uppercase letter' },
  { test: /[a-z]/, message: 'at least one lowercase letter' },
  { test: /[0-9]/, message: 'at least one number' },
  { test: /[^A-Za-z0-9]/, message: 'at least one special character' },
]

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (typeof password !== 'string' || password.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters`)
  }

  for (const rule of rules) {
    if (!rule.test.test(password)) {
      errors.push(`Password must contain ${rule.message}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

export const PASSWORD_REQUIREMENTS =
  'Password must be at least 8 characters with uppercase, lowercase, number, and special character.'
