const PII_PATTERNS: RegExp[] = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  /\bsk-[A-Za-z0-9_-]{10,}\b/g,
  /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
]

function redact(value: string): string {
  let result = value
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]')
  }
  return result
}

function serialize(arg: unknown): string {
  if (typeof arg === 'string') return redact(arg)
  try {
    return redact(JSON.stringify(arg))
  } catch {
    return '[Unserializable]'
  }
}

const isProduction = process.env.NODE_ENV === 'production'

export const logger = {
  debug(...args: unknown[]) {
    if (!isProduction) {
      console.debug('[neatplan]', ...args.map(serialize))
    }
  },
  info(...args: unknown[]) {
    console.info('[neatplan]', ...args.map(serialize))
  },
  warn(...args: unknown[]) {
    console.warn('[neatplan]', ...args.map(serialize))
  },
  error(message: string, error?: unknown) {
    const detail = error instanceof Error ? error.message : serialize(error)
    console.error('[neatplan]', redact(message), isProduction ? redact(detail) : detail)
  },
}
