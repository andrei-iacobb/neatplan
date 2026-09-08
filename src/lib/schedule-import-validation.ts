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

export const createScheduleInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    detectedFrequency: optionalBoundedText(100),
    suggestedFrequency: z.enum(SCHEDULE_FREQUENCY_VALUES),
    siteIds: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
    tasks: z
      .array(
        z
          .object({
            description: z.string().trim().min(1).max(1000),
            frequency: optionalBoundedText(100),
            additionalNotes: optionalBoundedText(2000),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict()

export type CreateScheduleInput = z.infer<typeof createScheduleInputSchema>
