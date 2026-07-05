import OpenAI from 'openai'
import sharp from 'sharp'
import * as z from 'zod'
import type { ScheduleFrequency } from '@prisma/client'
import { getSchedulePrimaryFrequency, inferFrequencyFromTasks } from './frequency-mapping'

export interface ExtractedScheduleTask {
  description: string
  frequency: string | null
  additionalNotes: string | null
}

export interface ExtractedSchedule {
  title: string
  detectedFrequency: string | null
  suggestedFrequency: ScheduleFrequency
  area: string | null
  tasks: ExtractedScheduleTask[]
}

export type ScheduleExtractionCode = 'SCANNED_PDF' | 'EMPTY' | 'NO_TASKS' | 'OPENAI' | 'UNSUPPORTED'

export class ScheduleExtractionError extends Error {
  code: ScheduleExtractionCode

  constructor(code: ScheduleExtractionCode, message: string) {
    super(message)
    this.name = 'ScheduleExtractionError'
    this.code = code
    Object.setPrototypeOf(this, ScheduleExtractionError.prototype)
  }
}

const SCHEDULE_EXTRACTION_MODEL = 'gpt-4o' as const
const SCHEDULE_EXTRACTION_JSON_SCHEMA_NAME = 'schedule_extraction_result' as const

let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new ScheduleExtractionError('OPENAI', 'OpenAI API key not configured')
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      timeout: 60_000,
      maxRetries: 2,
    })
  }

  return openaiClient
}

const modelTaskSchema = z
  .object({
    description: z.string(),
    frequency: z.string().nullable(),
    estimatedDuration: z.string().nullable(),
    area: z.string().nullable(),
    notes: z.string().nullable(),
  })
  .strict()

const modelExtractionSchema = z
  .object({
    title: z.string(),
    documentType: z.string().nullable(),
    frequency: z.string().nullable(),
    area: z.string().nullable(),
    tasks: z.array(modelTaskSchema),
  })
  .strict()

type ModelExtraction = z.infer<typeof modelExtractionSchema>

const scheduleExtractionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'documentType', 'frequency', 'area', 'tasks'],
  properties: {
    title: {
      type: 'string',
    },
    documentType: {
      type: ['string', 'null'],
    },
    frequency: {
      type: ['string', 'null'],
    },
    area: {
      type: ['string', 'null'],
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['description', 'frequency', 'estimatedDuration', 'area', 'notes'],
        properties: {
          description: {
            type: 'string',
          },
          frequency: {
            type: ['string', 'null'],
          },
          estimatedDuration: {
            type: ['string', 'null'],
          },
          area: {
            type: ['string', 'null'],
          },
          notes: {
            type: ['string', 'null'],
          },
        },
      },
    },
  },
} as const

const SYSTEM_PROMPT = [
  'You are an expert at reading cleaning schedules and checklists in any layout.',
  'Documents may use tables, grids, columns, checkboxes, bullets, numbered lists, free text, or handwriting.',
  'Extract every cleaning task you can find. Do not invent tasks.',
  'Capture per-task frequency, estimated duration, area or room, and special or compliance notes when present.',
  'Recognize frequencies such as daily, weekly, monthly, quarterly, annually, after vacancy or void, post-infection or infection control, and as required.',
].join(' ')

function isBlankish(value: string | null | undefined): boolean {
  if (typeof value !== 'string') {
    return true
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return true
  }

  const lower = trimmed.toLowerCase()
  return lower === 'undefined' || lower === 'null'
}

function normalizeFreeText(value: string | null | undefined): string | null {
  if (isBlankish(value)) {
    return null
  }

  return (value as string).trim()
}

function normalizeDetectedFrequency(value: string | null | undefined): string | null {
  const normalized = normalizeFreeText(value)
  if (!normalized) {
    return null
  }

  if (normalized.toLowerCase() === 'not specified') {
    return null
  }

  return normalized
}

function normalizeArea(value: string | null | undefined): string | null {
  const normalized = normalizeFreeText(value)
  if (!normalized) {
    return null
  }

  if (normalized.toLowerCase() === 'general') {
    return null
  }

  return normalized
}

function normalizeTitleCandidate(value: string | null | undefined): string | null {
  return normalizeFreeText(value)
}

function buildFallbackTitle(documentType: string | null, area: string | null): string {
  const parts = [documentType, area]
    .map((part) => normalizeTitleCandidate(part))
    .filter((part): part is string => Boolean(part))
    .filter((part) => part.toLowerCase() !== 'general')

  if (parts.length > 0) {
    return parts.join(' - ').trim()
  }

  return 'Cleaning Schedule'
}

function normalizeTaskFrequency(value: string | null | undefined): string | null {
  return normalizeFreeText(value)
}

function buildAdditionalNotes(task: ModelExtraction['tasks'][number]): string | null {
  const parts = [task.notes, task.estimatedDuration, task.area]
    .map((part) => normalizeFreeText(part))
    .filter((part): part is string => Boolean(part))

  return parts.length > 0 ? parts.join(' | ') : null
}

function dedupeTasks(tasks: ModelExtraction['tasks']): ExtractedScheduleTask[] {
  const seen = new Set<string>()
  const extracted: ExtractedScheduleTask[] = []

  for (const task of tasks) {
    const description = task.description.trim()
    if (description.length <= 2) {
      continue
    }

    const key = description.toLowerCase().replace(/\s+/g, ' ').trim()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    extracted.push({
      description,
      frequency: normalizeTaskFrequency(task.frequency),
      additionalNotes: buildAdditionalNotes(task),
    })
  }

  return extracted
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default
  const { text } = await pdfParse(buffer)
  return text
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = (await import('mammoth')).default
  const { value } = await mammoth.extractRawText({ buffer })
  return value
}

async function prepareDocumentText(params: {
  buffer: Buffer
  mimeType: string
}): Promise<{ mode: 'text' | 'vision'; content: string; imageBase64?: string }> {
  const { buffer, mimeType } = params

  if (mimeType.startsWith('image/')) {
    const imageBuffer = await sharp(buffer)
      .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
      .toBuffer()

    return {
      mode: 'vision',
      content: `data:${mimeType};base64,${imageBuffer.toString('base64')}`,
    }
  }

  if (mimeType === 'application/pdf') {
    let text: string
    try {
      text = await extractPdfText(buffer)
    } catch (error) {
      console.error('PDF text extraction failed', error)
      throw new ScheduleExtractionError(
        'EMPTY',
        'Could not read text from this PDF. Try uploading a clear photo or image of the schedule instead.'
      )
    }
    if (text.trim().length < 40) {
      throw new ScheduleExtractionError(
        'SCANNED_PDF',
        'This looks like a scanned PDF with no extractable text. Upload a clear photo/image of the schedule instead.'
      )
    }

    return { mode: 'text', content: text }
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    let text: string
    try {
      text = await extractDocxText(buffer)
    } catch (error) {
      console.error('DOCX text extraction failed', error)
      throw new ScheduleExtractionError(
        'EMPTY',
        'Could not read text from this Word document. Try uploading a PDF or image instead.'
      )
    }
    return { mode: 'text', content: text }
  }

  throw new ScheduleExtractionError('UNSUPPORTED', `Unsupported document type: ${mimeType}`)
}

function buildUserTextPrompt(text: string, fileName?: string): string {
  const trimmedText = text.trim().slice(0, 50_000)
  // Strip newlines from the (untrusted) filename to avoid prompt-injection via the file name.
  const fileHint = normalizeFreeText(fileName?.replace(/[\r\n]+/g, ' '))

  return [
    fileHint ? `File name: ${fileHint}` : null,
    'Extract a structured cleaning schedule from the document below.',
    'Return the full schedule metadata and all tasks.',
    'Document text:',
    trimmedText,
  ]
    .filter((part): part is string => Boolean(part))
    .join('\n\n')
}

async function runExtractionWithOpenAI(params: {
  mode: 'text' | 'vision'
  content: string
  mimeType: string
  fileName?: string
}): Promise<ModelExtraction> {
  const client = getOpenAI()

  const messages =
    params.mode === 'vision'
      ? [
          {
            role: 'system' as const,
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user' as const,
            content: [
              {
                type: 'text' as const,
                text: 'Extract the cleaning schedule from this image. Return a structured JSON object that follows the provided schema.',
              },
              {
                type: 'image_url' as const,
                image_url: {
                  url: params.content,
                  detail: 'high' as const,
                },
              },
            ],
          },
        ]
      : [
          {
            role: 'system' as const,
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user' as const,
            content: buildUserTextPrompt(params.content, params.fileName),
          },
        ]

  try {
    const completion = await client.chat.completions.create({
      model: SCHEDULE_EXTRACTION_MODEL,
      temperature: 0.1,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: SCHEDULE_EXTRACTION_JSON_SCHEMA_NAME,
          strict: true,
          schema: scheduleExtractionJsonSchema,
        },
      },
    })

    const rawContent = completion.choices[0]?.message?.content
    if (!rawContent) {
      throw new ScheduleExtractionError('OPENAI', 'Model returned unexpected output')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(rawContent)
    } catch {
      throw new ScheduleExtractionError('OPENAI', 'Model returned unexpected output')
    }

    const validated = modelExtractionSchema.safeParse(parsed)
    if (!validated.success) {
      console.error('Schedule extraction zod validation failed:', validated.error.flatten())
      throw new ScheduleExtractionError('OPENAI', 'Model returned unexpected output')
    }

    return validated.data
  } catch (error) {
    if (error instanceof ScheduleExtractionError) {
      throw error
    }

    console.error('OpenAI schedule extraction failed', error)
    throw new ScheduleExtractionError('OPENAI', 'Failed to extract schedule from document')
  }
}

export async function extractScheduleFromDocument(params: {
  buffer: Buffer
  mimeType: string
  fileName?: string
}): Promise<ExtractedSchedule> {
  try {
    const prepared = await prepareDocumentText({ buffer: params.buffer, mimeType: params.mimeType })
    const modelResult = await runExtractionWithOpenAI({
      mode: prepared.mode,
      content: prepared.content,
      mimeType: params.mimeType,
      fileName: params.fileName,
    })

    const tasks = dedupeTasks(modelResult.tasks)
    if (tasks.length === 0) {
      throw new ScheduleExtractionError('NO_TASKS', 'No cleaning tasks could be found in this document.')
    }

    const detectedFrequency = normalizeDetectedFrequency(modelResult.frequency)
    const area = normalizeArea(modelResult.area)
    const title = normalizeFreeText(modelResult.title) || buildFallbackTitle(modelResult.documentType, area)

    return {
      title,
      detectedFrequency,
      suggestedFrequency: detectedFrequency
        ? getSchedulePrimaryFrequency(detectedFrequency)
        : inferFrequencyFromTasks(tasks.map((task) => ({ frequency: task.frequency }))),
      area,
      tasks,
    }
  } catch (error) {
    if (error instanceof ScheduleExtractionError) {
      throw error
    }

    console.error('Schedule extraction failed', error)
    throw new ScheduleExtractionError('OPENAI', 'Failed to extract schedule from document')
  }
}
