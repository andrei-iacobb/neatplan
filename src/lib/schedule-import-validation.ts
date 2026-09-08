import * as z from 'zod'

export const SCHEDULE_FREQUENCY_VALUES = [
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'YEARLY',
] as const

const optionalBoundedText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable().optional()

// Extracted frequency text is a read-only hint; the reviewed enum sets recurrence.
const importedFrequencyText = z.string().trim().transform(value => value.slice(0, 100) || null).nullable().optional()

export const createScheduleInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    detectedFrequency: importedFrequencyText,
    suggestedFrequency: z.enum(SCHEDULE_FREQUENCY_VALUES),
    siteIds: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
    tasks: z
      .array(
        z
          .object({
            description: z.string().trim().min(1).max(1000),
            frequency: importedFrequencyText,
            additionalNotes: optionalBoundedText(2000),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict()

export type CreateScheduleInput = z.infer<typeof createScheduleInputSchema>
