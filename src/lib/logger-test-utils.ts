export function redact(value: string): string {
  return value
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{10,}\b/g, '[REDACTED]')
}
