import { describe, expect, it } from 'vitest'
import {
  getSchedulePrimaryFrequency,
  inferFrequencyFromTasks,
  mapFrequencyStringToEnum,
} from '@/lib/frequency-mapping'

describe('AI frequency mapping', () => {
  it('maps explicit supported occurrences', () => {
    expect(mapFrequencyStringToEnum('Every day')).toBe('DAILY')
    expect(mapFrequencyStringToEnum('Once a week')).toBe('WEEKLY')
    expect(mapFrequencyStringToEnum('Every 3 months')).toBe('QUARTERLY')
  })

  it('leaves missing and unrecognised occurrences unresolved', () => {
    expect(mapFrequencyStringToEnum(null)).toBeNull()
    expect(mapFrequencyStringToEnum('regularly')).toBeNull()
    expect(getSchedulePrimaryFrequency('when required')).toBeNull()
    expect(getSchedulePrimaryFrequency('after vacancy')).toBeNull()
    expect(getSchedulePrimaryFrequency('post-infection')).toBeNull()
  })

  it.each(['biweekly', 'bi-weekly', 'every two weeks', 'fortnightly'])(
    'preserves the two-week interval for %s', (frequency) => {
      expect(mapFrequencyStringToEnum(frequency)).toBe('BIWEEKLY')
    },
  )

  it.each(['not daily', 'daily or weekly', 'twice weekly', 'every 2 months', 'weekly or after vacancy'])(
    'leaves ambiguous or unsupported %s for manual review', (frequency) => {
      expect(mapFrequencyStringToEnum(frequency)).toBeNull()
    },
  )

  it.each([
    ['monthly', 'MONTHLY'], ['three monthly', 'QUARTERLY'],
    ['six monthly', 'SEMIANNUAL'], ['semiannual', 'SEMIANNUAL'],
    ['annual', 'YEARLY'], ['every 2 weeks', 'BIWEEKLY'],
  ])('maps supported %s to %s', (input, expected) => {
    expect(mapFrequencyStringToEnum(input)).toBe(expected)
  })

  it('only infers a task frequency when there is one clear supported majority', () => {
    expect(inferFrequencyFromTasks([{ frequency: null }, { frequency: 'unclear' }])).toBeNull()
    expect(inferFrequencyFromTasks([{ frequency: 'daily' }, { frequency: 'weekly' }])).toBeNull()
    expect(
      inferFrequencyFromTasks([
        { frequency: 'daily' },
        { frequency: 'daily' },
        { frequency: 'weekly' },
      ]),
    ).toBe('DAILY')
  })
})
