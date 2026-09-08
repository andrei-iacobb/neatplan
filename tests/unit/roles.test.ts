import { describe, expect, it } from 'vitest'
import {
  ALL_ROLES,
  canAssignRole,
  canUseCleaningPortal,
  hasMinRole,
  isManagementRole,
  requiresSite,
  ROLE_LABELS,
} from '@/lib/roles'

describe('Head of Housekeeping role', () => {
  it('sits between Manager and Cleaner in the hierarchy', () => {
    expect(hasMinRole('MANAGER', 'HEAD_OF_HOUSEKEEPING')).toBe(true)
    expect(hasMinRole('HEAD_OF_HOUSEKEEPING', 'MANAGER')).toBe(false)
    expect(hasMinRole('HEAD_OF_HOUSEKEEPING', 'CLEANER')).toBe(true)
  })

  it('can use management features and retain cleaning duties', () => {
    expect(isManagementRole('HEAD_OF_HOUSEKEEPING')).toBe(true)
    expect(canUseCleaningPortal('HEAD_OF_HOUSEKEEPING')).toBe(true)
    expect(canUseCleaningPortal('CLEANER')).toBe(true)
    expect(canUseCleaningPortal('MANAGER')).toBe(false)
  })

  it('is site-pinned and may only manage cleaners', () => {
    expect(requiresSite('HEAD_OF_HOUSEKEEPING')).toBe(true)
    expect(canAssignRole('HEAD_OF_HOUSEKEEPING', 'CLEANER')).toBe(true)
    expect(canAssignRole('HEAD_OF_HOUSEKEEPING', 'HEAD_OF_HOUSEKEEPING')).toBe(false)
    expect(canAssignRole('HEAD_OF_HOUSEKEEPING', 'MANAGER')).toBe(false)
  })

  it('is available with the expected user-facing label', () => {
    expect(ALL_ROLES).toContain('HEAD_OF_HOUSEKEEPING')
    expect(ROLE_LABELS.HEAD_OF_HOUSEKEEPING).toBe('Head of Housekeeping')
  })
})
