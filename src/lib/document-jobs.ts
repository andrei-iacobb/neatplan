import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getAIClient } from './ai-provider'
import { ocrImageToText } from './ocr'

const JOBS_DIR = path.join(process.cwd(), 'data', 'document-jobs')

const CLEANING_KEYWORDS = [
  'clean', 'wipe', 'dust', 'vacuum', 'mop', 'wash', 'shampoo', 'polish',
  'sanitize', 'disinfect', 'remove', 'hoover', 'deep clean', 'room', 'frequency',
]

function extractRelevantContent(content: string): string {
  const sentences = content.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 10)
  const scored = sentences.map((sentence) => {
    let score = 0
    const lower = sentence.toLowerCase()
    CLEANING_KEYWORDS.forEach((keyword) => {
      if (lower.includes(keyword)) score += 2
    })
    if (/task|checklist|schedule|daily|weekly|monthly/.test(lower)) score += 5
    return { sentence, score }
  })
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map((item) => item.sentence)
    .join('\n')
}

async function processDocxFile(buffer: Buffer): Promise<string> {
  const mammoth = (await import('mammoth')).default
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

async function processPdfFile(buffer: Buffer): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default
  const pdfData = await pdfParse(buffer)
  return pdfData.text
}

export async function extractContentFromFile(
  buffer: Buffer,
  fileType: string
): Promise<{ content: string; processingMethod: string }> {
  if (fileType === 'application/pdf') {
    const content = extractRelevantContent(await processPdfFile(buffer))
    return { content, processingMethod: 'OCR' }
  }

  if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const raw = await processDocxFile(buffer)
    return { content: extractRelevantContent(raw), processingMethod: 'Text Extraction + NLP' }
  }

  if (fileType.startsWith('image/')) {
    const { client, model, supportsVision } = getAIClient()

    if (!supportsVision) {
      // Local provider: OCR the image and feed the text through the same
      // downstream text pipeline. OcrUnavailableError propagates and fails the
      // job with its message; empty OCR text fails via the existing
      // "no content" check in runDocumentJob.
      const ocrText = (await ocrImageToText(buffer)).trim()
      return { content: ocrText, processingMethod: 'OCR (Tesseract)' }
    }

    const imageBuffer = await sharp(buffer).resize(1024, 1024, { fit: 'inside' }).toBuffer()
    const base64Image = imageBuffer.toString('base64')
    const visionResponse = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract cleaning tasks from this image. Format each task with its description, frequency, and estimated duration.',
            },
            {
              type: 'image_url',
              image_url: { url: `data:${fileType};base64,${base64Image}` },
            },
          ],
        },
      ],
      max_tokens: 1500,
    })
    return {
      content: visionResponse.choices[0]?.message?.content || '',
      processingMethod: 'Vision API',
    }
  }

  throw new Error('Unsupported file type')
}

export async function runAiSchedule(content: string): Promise<unknown> {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:4040'
  const response = await fetch(`${baseUrl}/api/ai/schedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-job': process.env.CRON_SECRET || '',
    },
    body: JSON.stringify({ content }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || 'AI schedule processing failed')
  }
  return data
}

export async function ensureJobsDir(): Promise<void> {
  await fs.mkdir(JOBS_DIR, { recursive: true })
}

export function getJobFilePath(jobId: string): string {
  return path.join(JOBS_DIR, jobId, 'upload')
}

export async function createDocumentJob(params: {
  userId: string
  fileName: string
  fileType: string
  buffer: Buffer
}): Promise<string> {
  await ensureJobsDir()
  const job = await prisma.documentJob.create({
    data: {
      userId: params.userId,
      fileName: params.fileName,
      fileType: params.fileType,
      filePath: '',
      status: 'PENDING',
    },
  })

  const jobDir = path.join(JOBS_DIR, job.id)
  await fs.mkdir(jobDir, { recursive: true })
  const filePath = path.join(jobDir, 'upload')
  await fs.writeFile(filePath, params.buffer)

  await prisma.documentJob.update({
    where: { id: job.id },
    data: { filePath },
  })

  return job.id
}

export async function runDocumentJob(jobId: string): Promise<void> {
  const job = await prisma.documentJob.findUnique({ where: { id: jobId } })
  if (!job || job.status !== 'PENDING') return

  await prisma.documentJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING' },
  })

  try {
    const buffer = await fs.readFile(job.filePath)
    const { content, processingMethod } = await extractContentFromFile(buffer, job.fileType)

    if (!content.trim()) {
      throw new Error('No content could be extracted from the file')
    }

    const aiResult = (await runAiSchedule(content)) as {
      schedule: unknown
      processingInfo?: unknown
    }

    await prisma.documentJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        result: {
          success: true,
          processingMethod,
          schedule: aiResult.schedule,
          processingInfo: aiResult.processingInfo,
          metadata: {
            filename: job.fileName,
            fileType: job.fileType,
          },
        } as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Processing failed'
    logger.error('Document job failed', error)
    await prisma.documentJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        error: message,
        completedAt: new Date(),
      },
    })
  } finally {
    try {
      await fs.rm(path.dirname(job.filePath), { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  }
}

export function queueDocumentJob(jobId: string): void {
  setImmediate(() => {
    runDocumentJob(jobId).catch((error) => logger.error('Background document job error', error))
  })
}
