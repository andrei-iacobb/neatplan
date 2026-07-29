import { describe, it, expect } from 'vitest'
import {
  resolveReadSiteId,
  readSiteWhere,
  nestedReadSiteWhere,
  m2mReadSiteWhere,
} from '@/lib/authz'

const MAPLE = 'site_maple'
const OTHER = 'site_other'
const NO_SITE = '__no_site__'

const user = (role: string, siteId: string | null = null) =>
  ({ id: 'u1', role, siteId } as any)

describe('resolveReadSiteId', () => {
  it('returns null for an all-sites role that asked for nothing', () => {
    expect(resolveReadSiteId(user('OP'))).toBeNull()
    expect(resolveReadSiteId(user('DIRECTOR'))).toBeNull()
  })

  it('treats the "all" sentinel as no filter', () => {
    expect(resolveReadSiteId(user('OP'), 'all')).toBeNull()
  })

  it('honours a requested site for an all-sites role', () => {
    expect(resolveReadSiteId(user('OP'), MAPLE)).toBe(MAPLE)
    expect(resolveReadSiteId(user('DIRECTOR'), MAPLE)).toBe(MAPLE)
  })

  it('ignores the request entirely for a pinned role', () => {
    // The whole point: a MANAGER asking for someone else's site gets their own.
    expect(resolveReadSiteId(user('MANAGER', MAPLE), OTHER)).toBe(MAPLE)
    expect(resolveReadSiteId(user('CLEANER', MAPLE), OTHER)).toBe(MAPLE)
    expect(resolveReadSiteId(user('MANAGER', MAPLE), 'all')).toBe(MAPLE)
  })

  it('fails closed when a pinned role has no site assigned', () => {
    expect(resolveReadSiteId(user('MANAGER', null))).toBe(NO_SITE)
    expect(resolveReadSiteId(user('CLEANER', null), MAPLE)).toBe(NO_SITE)
  })

  it('treats an unknown role as pinned rather than all-sites', () => {
    expect(resolveReadSiteId(user('SOMETHING_NEW', MAPLE), OTHER)).toBe(MAPLE)
    expect(resolveReadSiteId(user('SOMETHING_NEW', null), MAPLE)).toBe(NO_SITE)
  })
})

describe('read scope shapers', () => {
  it('produce an empty clause when unfiltered, so an all-sites read is unchanged', () => {
    expect(readSiteWhere(null)).toEqual({})
    expect(nestedReadSiteWhere(null, 'room')).toEqual({})
    expect(m2mReadSiteWhere(null)).toEqual({})
  })

  it('match the three relationship shapes already in authz', () => {
    expect(readSiteWhere(MAPLE)).toEqual({ siteId: MAPLE })
    expect(nestedReadSiteWhere(MAPLE, 'room')).toEqual({ room: { siteId: MAPLE } })
    expect(m2mReadSiteWhere(MAPLE)).toEqual({ sites: { some: { id: MAPLE } } })
  })

  it('carry the fail-closed sentinel through rather than dropping the filter', () => {
    const pinned = resolveReadSiteId(user('MANAGER', null), MAPLE)
    expect(readSiteWhere(pinned)).toEqual({ siteId: NO_SITE })
  })
})
