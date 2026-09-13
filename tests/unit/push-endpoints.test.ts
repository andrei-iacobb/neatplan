import { describe, it, expect, afterEach } from 'vitest'
import { checkPushEndpoint } from '@/lib/push/endpoints'

const ORIGINAL = process.env.PUSH_ALLOWED_HOSTS

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.PUSH_ALLOWED_HOSTS
  else process.env.PUSH_ALLOWED_HOSTS = ORIGINAL
})

describe('endpoints a real browser produces', () => {
  it('accepts the push services browsers actually use', () => {
    for (const endpoint of [
      'https://fcm.googleapis.com/fcm/send/abc123',
      'https://android.googleapis.com/gcm/send/abc123',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/QK123',
      'https://par02p.notify.windows.com/w/?token=abc',
    ]) {
      expect(checkPushEndpoint(endpoint), endpoint).toMatchObject({ ok: true })
    }
  })

  it('accepts a subdomain of an allowed service', () => {
    expect(checkPushEndpoint('https://fcm-eu.fcm.googleapis.com/send/x')).toMatchObject({
      ok: true,
    })
  })
})

describe('the beacon this exists to stop', () => {
  it('refuses a cloud metadata address', () => {
    // Stored, this becomes a request the scheduler makes on a timer, carrying a
    // signed Authorization header, to an address the submitter cannot reach
    // themselves. Non-permanent failures are retried, so it fires forever.
    expect(
      checkPushEndpoint('http://169.254.169.254/latest/meta-data/iam/security-credentials/')
    ).toMatchObject({ ok: false })
  })

  it('refuses an internal host', () => {
    for (const endpoint of [
      'https://127.0.0.1/admin',
      'https://localhost/admin',
      'https://10.0.0.5/internal',
      'https://192.168.1.1/router',
      'https://[::1]/admin',
      'https://intranet.local/secrets',
    ]) {
      expect(checkPushEndpoint(endpoint), endpoint).toMatchObject({ ok: false })
    }
  })

  it('refuses plain HTTP even to an allowed host', () => {
    expect(checkPushEndpoint('http://fcm.googleapis.com/fcm/send/x')).toMatchObject({ ok: false })
  })

  it('refuses a host that merely contains an allowed one', () => {
    // The classic bypass: suffix matching without a dot boundary.
    for (const endpoint of [
      'https://fcm.googleapis.com.attacker.example/send',
      'https://evil-fcm.googleapis.com.evil.net/send',
      'https://notfcm.googleapis.com.co/send',
    ]) {
      expect(checkPushEndpoint(endpoint), endpoint).toMatchObject({ ok: false })
    }
  })

  it('refuses an unrelated host outright', () => {
    expect(checkPushEndpoint('https://attacker.example/collect')).toMatchObject({ ok: false })
  })

  it('refuses a non-http scheme', () => {
    for (const endpoint of ['file:///etc/passwd', 'ftp://host/x', 'gopher://host/x']) {
      expect(checkPushEndpoint(endpoint), endpoint).toMatchObject({ ok: false })
    }
  })

  it('refuses something that is not a URL at all', () => {
    expect(checkPushEndpoint('not a url')).toMatchObject({ ok: false })
    expect(checkPushEndpoint('')).toMatchObject({ ok: false })
  })

  it('explains itself rather than failing blankly', () => {
    const result = checkPushEndpoint('https://attacker.example/collect')
    expect(result.reason).toBeTruthy()
  })
})

describe('extending the list for an unusual deployment', () => {
  it('accepts a host an operator has explicitly allowed', () => {
    process.env.PUSH_ALLOWED_HOSTS = 'push.internal.example'
    expect(checkPushEndpoint('https://push.internal.example/send/x')).toMatchObject({ ok: true })
  })

  it('still applies the dot boundary to a configured host', () => {
    process.env.PUSH_ALLOWED_HOSTS = 'push.internal.example'
    expect(checkPushEndpoint('https://push.internal.example.evil.net/send')).toMatchObject({
      ok: false,
    })
  })

  it('ignores blank entries in the list', () => {
    process.env.PUSH_ALLOWED_HOSTS = ' , ,  '
    expect(checkPushEndpoint('https://attacker.example/x')).toMatchObject({ ok: false })
  })
})
