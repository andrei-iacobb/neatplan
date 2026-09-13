/**
 * Which push endpoints the server is willing to call.
 *
 * A subscription endpoint is a URL the server will later POST to, unprompted,
 * on a timer. Storing an arbitrary one turns the scheduler into a persistent
 * outbound request beacon pointed wherever the submitter chose - a cloud
 * metadata address, an internal admin panel, anything the app server can reach
 * but the submitter cannot. Non-permanent failures are retried, so it would
 * keep firing indefinitely.
 *
 * An allowlist is the only reliable defence. A blocklist of private ranges is
 * defeated by a public hostname that resolves to an internal address, and
 * re-resolving at send time does not help either - the name can answer
 * differently each time.
 *
 * The trade is that a browser using a push service not listed here cannot
 * subscribe. That is the right way round: a refusal is visible and fixable,
 * where an open endpoint is neither.
 */

/**
 * The push services real browsers use. Matched on the registrable host or a
 * subdomain of it, never on a substring - "evil-fcm.googleapis.com.attacker.net"
 * must not pass.
 */
const DEFAULT_ALLOWED_HOSTS = [
  // Chrome, Edge and every other Chromium browser
  'fcm.googleapis.com',
  'android.googleapis.com',
  // Firefox
  'updates.push.services.mozilla.com',
  'push.services.mozilla.com',
  // Safari, iOS and macOS
  'web.push.apple.com',
  // Legacy Edge / Windows
  'notify.windows.com',
]

/**
 * Extra hosts for a deployment using something unusual - a self-hosted push
 * service, or a browser that ships after this list was written. Comma separated.
 * Adding a host here is a decision to let the server call it on a timer.
 */
function configuredHosts(): string[] {
  return (process.env.PUSH_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
}

export function allowedPushHosts(): string[] {
  return [...DEFAULT_ALLOWED_HOSTS, ...configuredHosts()]
}

/** `a.b.example.com` is under `example.com`; `example.com.evil.net` is not. */
function isHostOrSubdomainOf(host: string, allowed: string): boolean {
  return host === allowed || host.endsWith(`.${allowed}`)
}

export interface EndpointCheck {
  ok: boolean
  /** Phrased for whoever sees it in a log or a response. */
  reason?: string
}

/**
 * Is this an endpoint the server may store and later call?
 *
 * Rejects anything that is not HTTPS, anything addressed by IP literal rather
 * than name, and any host not on the allowlist.
 */
export function checkPushEndpoint(endpoint: string): EndpointCheck {
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return { ok: false, reason: 'That is not a valid push endpoint.' }
  }

  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'A push endpoint must be https.' }
  }

  const host = url.hostname.toLowerCase()

  /*
   * An IP literal can never be a real push service, and it is the shortest path
   * to a metadata endpoint or an internal host. Covers IPv4, IPv6 in brackets,
   * and the decimal/hex forms that also parse as addresses.
   */
  if (/^\[?[0-9a-f:.]+\]?$/i.test(host) && !/[a-z]/i.test(host.replace(/^\[|\]$/g, '').replace(/[a-f]/gi, ''))) {
    return { ok: false, reason: 'A push endpoint must be a named host.' }
  }
  if (/^\d+$/.test(host.replace(/\./g, '')) || host.startsWith('[')) {
    return { ok: false, reason: 'A push endpoint must be a named host.' }
  }

  const allowed = allowedPushHosts()
  if (!allowed.some((candidate) => isHostOrSubdomainOf(host, candidate))) {
    return {
      ok: false,
      reason: 'That push service is not one this server is set up to use.',
    }
  }

  return { ok: true }
}
