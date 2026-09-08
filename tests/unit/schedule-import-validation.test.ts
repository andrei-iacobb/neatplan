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

  it('bounds read-only extracted hints without changing the reviewed frequency', () => {
    const hint = 'Weekly, with additional requirements from the original document. '.repeat(5)
    const parsed = createScheduleInputSchema.parse({
      ...validInput,
      detectedFrequency: hint,
      tasks: [{ ...validInput.tasks[0], frequency: hint }],
    })
    expect(parsed.detectedFrequency).toBe(hint.trim().slice(0, 100))
    expect(parsed.tasks[0].frequency).toBe(hint.trim().slice(0, 100))
    expect(parsed.suggestedFrequency).toBe('WEEKLY')
  })

  it('treats blank extraction hints as absent', () => {
    const parsed = createScheduleInputSchema.parse({ ...validInput, detectedFrequency: '  ' })
    expect(parsed.detectedFrequency).toBeNull()
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
