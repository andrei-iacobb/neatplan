'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '@/lib/url-utils'

/**
 * The real browser push subscription, replacing a switch that stored a boolean
 * and did nothing with it.
 *
 * Three things have to line up before a notification can arrive, and all three
 * can fail independently: the deployment needs VAPID keys, the browser needs to
 * support push at all, and the person has to grant permission. The state below
 * distinguishes them so the UI can say which one is missing instead of showing a
 * switch that silently refuses to move.
 */

export type PushState =
  /** Still working out where we stand. */
  | 'checking'
  /** The server has no VAPID keys, so push cannot work here at all. */
  | 'unconfigured'
  /** This browser has no push support - older Safari, some embedded webviews. */
  | 'unsupported'
  /** The person said no, and only they can undo that, in browser settings. */
  | 'denied'
  /** Available, not yet subscribed. */
  | 'idle'
  /** Subscribed on this device. */
  | 'subscribed'

/**
 * Base64url to the bytes `pushManager.subscribe` wants.
 *
 * The explicit ArrayBuffer is not decoration: a bare `new Uint8Array(n)` is
 * typed over ArrayBufferLike, which includes SharedArrayBuffer, and the
 * BufferSource the subscribe call accepts does not.
 */
function decodeKey(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const raw = atob(padded)
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export interface UsePushSubscription {
  state: PushState
  /** True while a subscribe or unsubscribe is in flight. */
  busy: boolean
  /** Non-null when the last action failed, phrased for the person reading it. */
  error: string | null
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
}

export function usePushSubscription(): UsePushSubscription {
  const [state, setState] = useState<PushState>('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publicKey, setPublicKey] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    // Feature detection before anything else: asking the server about push is
    // pointless in a browser that cannot receive it.
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setState('unsupported')
      return
    }

    try {
      const response = await apiRequest('/api/push/subscribe')
      if (!response.ok) {
        setState('unsupported')
        return
      }

      const data = await response.json()
      if (!data.configured || !data.publicKey) {
        setState('unconfigured')
        return
      }
      setPublicKey(data.publicKey)

      if (Notification.permission === 'denied') {
        setState('denied')
        return
      }

      // The browser is the source of truth for whether THIS device is
      // subscribed. The server's count covers every device and would report a
      // desktop subscription as if it were this tablet's.
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      setState(existing ? 'subscribed' : 'idle')
    } catch {
      setState('unsupported')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const subscribe = useCallback(async () => {
    if (busy || !publicKey) return
    setBusy(true)
    setError(null)

    try {
      // Permission is requested from the click, not on page load. A browser
      // will refuse a prompt that did not come from a gesture, and a site that
      // asks the moment it loads is a site people click "block" on.
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'idle')
        setError(
          permission === 'denied'
            ? 'Your browser is blocking notifications for this site. You can allow them again in the browser settings for this page.'
            : 'Notifications were not allowed, so nothing changed.'
        )
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        // Required by every browser that implements push; a non-user-visible
        // push is not allowed.
        userVisibleOnly: true,
        applicationServerKey: decodeKey(publicKey),
      })

      const response = await apiRequest('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription.toJSON()),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        // Do not leave the browser subscribed to a server that did not record
        // it, or the person believes they will be notified and will not be.
        await subscription.unsubscribe().catch(() => undefined)
        setError(data?.error ?? 'This device could not be registered for notifications.')
        setState('idle')
        return
      }

      setState('subscribed')
    } catch {
      setError('This device could not be registered for notifications.')
      setState('idle')
    } finally {
      setBusy(false)
    }
  }, [busy, publicKey])

  const unsubscribe = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setError(null)

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        // Tell the server first. If the browser unsubscribes and the request
        // then fails, the row is left behind pushing at a dead endpoint.
        await apiRequest(
          `/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`,
          { method: 'DELETE' }
        )
        await subscription.unsubscribe()
      }

      setState('idle')
    } catch {
      setError('Notifications could not be turned off on this device. Try again.')
    } finally {
      setBusy(false)
    }
  }, [busy])

  return { state, busy, error, subscribe, unsubscribe }
}
