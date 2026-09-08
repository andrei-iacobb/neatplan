import { describe, expect, it } from 'vitest'
import { createScheduleInputSchema } from '@/lib/schedule-import-validation'

const validInput = {
  title: 'Weekly Kitchen Deep Clean',
  detectedFrequency: 'weekly',
  suggestedFrequency: 'WEEKLY',
  siteIds: ['site-1'],
  tasks: [
    {
      description: 'Clean extraction canopy',
      frequency: null,
      additionalNotes: null,
    },
  ],
}

describe('schedule import validation', () => {
  it('accepts a fully resolved reviewed schedule', () => {
    expect(createScheduleInputSchema.safeParse(validInput).success).toBe(true)
  })

  it.each([
    ['blank title', { ...validInput, title: '   ' }],
    ['missing frequency', { ...validInput, suggestedFrequency: undefined }],
    ['unknown frequency', { ...validInput, suggestedFrequency: 'OCCASIONALLY' }],
    ['no tasks', { ...validInput, tasks: [] }],
    [
      'blank task description',
      { ...validInput, tasks: [{ description: ' ', frequency: null, additionalNotes: null }] },
    ],
  ])('rejects an unresolved import with %s', (_case, input) => {
    expect(createScheduleInputSchema.safeParse(input).success).toBe(false)
  })
})
