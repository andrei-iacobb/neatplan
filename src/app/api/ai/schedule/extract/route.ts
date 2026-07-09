import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimitByUserOrIp } from '@/lib/rate-limit'
import { requireAdmin } from '@/lib/authz'
import {
  extractScheduleFromDocument,
  ScheduleExtractionError,
} from '@/lib/schedule-extraction'

export const runtime = 'nodejs'
export const maxDuration = 120 // vision/text extraction can take a while

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

// Map extraction error codes to HTTP status codes.
const STATUS_BY_CODE: Record<string, number> = {
  SCANNED_PDF: 422,
  NO_TASKS: 422,
  EMPTY: 422,
  UNSUPPORTED: 415,
  OCR: 422,
  OPENAI: 502,
  AI_PROVIDER: 502,
  BUSY: 429,
  TOO_LARGE: 413,
}

/**
 * Extract a structured cleaning schedule from an uploaded image/PDF/DOCX.
 * Returns an editable preview WITHOUT persisting anything — the client
 * confirms and then POSTs to /api/schedules to save.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin()
    if ("error" in auth) return auth.error

    // Reject oversized uploads by declared length before buffering the body into memory.
    const contentLength = Number(req.headers.get('content-length') || 0)
    if (contentLength > MAX_FILE_SIZE + 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 413 })
    }

    // Rate limit: 5 extractions per minute per user.
    const rate = checkRateLimitByUserOrIp(
      req as any,
      'ai_schedule_extract',
      5,
      60 * 1000,
      auth.user.email,
    )
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      )
    }

    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid form data. Upload a file.' }, { status: 400 })
    }
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
    }

    // Explicit allowlist only — do NOT accept any image/* (blocks SVG/TIFF and other
    // formats that could reach sharp with XXE/SSRF risk).
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload a PDF, DOCX, or image (JPG/PNG/WEBP/GIF).' },
        { status: 415 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Validate magic bytes match the claimed type (defence against spoofed extensions).
    if (file.type === 'application/pdf' && !(buffer.length >= 4 && buffer.subarray(0, 4).toString() === '%PDF')) {
      return NextResponse.json({ error: 'File content does not match PDF format' }, { status: 400 })
    }
    if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
      !(buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04)
    ) {
      return NextResponse.json({ error: 'File content does not match DOCX format' }, { status: 400 })
    }
    if (file.type.startsWith('image/')) {
      const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
      const isGif = buffer.subarray(0, 3).toString() === 'GIF'
      const isWebp =
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString() === 'RIFF' &&
        buffer.subarray(8, 12).toString() === 'WEBP'
      if (!isJpeg && !isPng && !isGif && !isWebp) {
        return NextResponse.json({ error: 'File content does not match a supported image format' }, { status: 400 })
      }
    }

    const result = await extractScheduleFromDocument({
      buffer,
      mimeType: file.type,
      fileName: file.name,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ScheduleExtractionError) {
      const status = STATUS_BY_CODE[error.code] ?? 500
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    console.error('Schedule extraction failed:', error)
    return NextResponse.json({ error: 'Failed to process the document.' }, { status: 500 })
  }
}
