import { createHmac, randomBytes } from 'crypto'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32[(value << (5 - bits)) & 31]
  }

  return output
}

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/, '').toUpperCase()
  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (const char of cleaned) {
    const idx = BASE32.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

export function getTotpUri(email: string, secret: string): string {
  const issuer = encodeURIComponent('NeatPlan')
  const label = encodeURIComponent(email)
  return `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
}

function generateTotp(secret: string, counter: number): string {
  const key = base32Decode(secret)
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(counter))

  const hmac = createHmac('sha1', key).update(buffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  return String(code % 1_000_000).padStart(6, '0')
}

export function verifyTotp(secret: string, token: string, window = 1): boolean {
  const normalized = token.replace(/\s/g, '')
  if (!/^\d{6}$/.test(normalized)) return false

  const counter = Math.floor(Date.now() / 1000 / 30)
  for (let i = -window; i <= window; i++) {
    if (generateTotp(secret, counter + i) === normalized) {
      return true
    }
  }
  return false
}
