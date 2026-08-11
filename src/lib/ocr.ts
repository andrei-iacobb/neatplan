import { execFile } from 'node:child_process'
import sharp from 'sharp'

export class OcrUnavailableError extends Error {
  constructor() {
    super(
      'Tesseract OCR is not installed on the server. Install tesseract (macOS: brew install tesseract, Windows: UB-Mannheim installer) or set SCHEDULE_AI_PROVIDER=openai with a valid OPENAI_API_KEY.'
    )
    this.name = 'OcrUnavailableError'
    Object.setPrototypeOf(this, OcrUnavailableError.prototype)
  }
}

export class OcrBusyError extends Error {
  constructor() {
    super('The server is busy processing other documents. Please try again in a moment.')
    this.name = 'OcrBusyError'
    Object.setPrototypeOf(this, OcrBusyError.prototype)
  }
}

// OCR is CPU-bound host work (sharp preprocess + a tesseract child process), so cap
// global concurrency instead of letting every authenticated request spawn its own
// process. Excess requests wait in a short queue; beyond that they get OcrBusyError
// (callers surface it as 429).
const MAX_CONCURRENT_OCR = Math.max(1, Number(process.env.OCR_MAX_CONCURRENCY) || 2)
const MAX_QUEUED_OCR = 8

let runningOcr = 0
const ocrWaiters: Array<() => void> = []

async function acquireOcrSlot(): Promise<() => void> {
  if (runningOcr < MAX_CONCURRENT_OCR) {
    runningOcr += 1
    return createOcrSlotRelease()
  }
  if (ocrWaiters.length >= MAX_QUEUED_OCR) {
    throw new OcrBusyError()
  }
  await new Promise<void>((resolve) => {
    ocrWaiters.push(resolve)
  })
  return createOcrSlotRelease()
}

function createOcrSlotRelease(): () => void {
  let released = false
  return () => {
    if (released) {
      return
    }
    released = true
    releaseOcrSlot()
  }
}

function releaseOcrSlot(): void {
  const next = ocrWaiters.shift()
  if (next) {
    // Hand the slot to the next waiter; runningOcr stays the same.
    next()
  } else {
    runningOcr -= 1
  }
}

export async function ocrImageToText(buffer: Buffer): Promise<string> {
  const releaseSlot = await acquireOcrSlot()
  try {
    return await runOcr(buffer)
  } finally {
    releaseSlot()
  }
}

async function runOcr(buffer: Buffer): Promise<string> {
  // Preprocess for OCR: grayscale, normalized contrast, size-capped PNG.
  // Cap at 2000px, not higher: Tesseract's line finder is tuned for ~20-40px
  // cap-height text and silently drops whole blocks when text is very large.
  // Modern phones shoot 3000-4000px, so a photo of a sparse schedule lands
  // exactly in that failure zone; downscaling to <=2000px keeps text in range.
  // (Measured: this document OCRs 0/11 rows at 3000px, 11/11 at <=2400px.)
  const preprocessed = await sharp(buffer)
    .grayscale()
    .normalize()
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()

  const tesseractPath = process.env.TESSERACT_PATH || 'tesseract'
  const tesseractLang = process.env.TESSERACT_LANG || 'eng'

  return new Promise<string>((resolve, reject) => {
    const child = execFile(/* turbopackIgnore: true */
      tesseractPath,
      ['stdin', 'stdout', '-l', tesseractLang],
      {
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30_000,
      },
      (error, stdout, stderr) => {
        if (!error) {
          resolve(stdout)
          return
        }

        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(new OcrUnavailableError())
          return
        }

        const stderrSnippet = (stderr || error.message || '').toString().slice(0, 500).trim()
        reject(new Error(`OCR processing failed: ${stderrSnippet}`))
      }
    )

    // execFile always pipes stdio, so stdin should exist; treat its absence as a
    // hard failure rather than silently letting tesseract wait on empty input
    // until the 30s timeout.
    if (!child.stdin) {
      child.kill()
      reject(new Error('OCR processing failed: could not open stdin pipe to tesseract'))
      return
    }

    // If the process fails to spawn (e.g. ENOENT), writing to stdin raises
    // EPIPE - swallow it so the execFile callback reports the real cause.
    child.stdin.on('error', () => {})
    child.stdin.end(preprocessed)
  })
}
