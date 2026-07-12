import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { checkRateLimitByUserOrIp } from '@/lib/rate-limit'
import sharp from 'sharp'
import { getAIClient } from '@/lib/ai-provider'
import { ocrImageToText, OcrBusyError, OcrUnavailableError } from '@/lib/ocr'
import { requireAdmin } from '@/lib/authz'

// Force dynamic behavior for the API route
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes timeout

// Define allowed methods
export const runtime = 'nodejs'

const CLEANING_KEYWORDS = [
  'clean', 'wipe', 'dust', 'vacuum', 'mop', 'wash', 'shampoo', 'polish',
  'sanitize', 'disinfect', 'remove', 'hoover',
  'deep clean', 'infection', 'vacant', 'routine', 'quarterly',
  'floor', 'carpet', 'curtains', 'blinds', 'mirror', 'window', 'furniture',
  'wardrobe', 'cupboard', 'bed', 'chair', 'table',
  'radiator', 'frame', 'sink', 'toilet', 'commode', 'extractor', 'fan',
  'room', 'area', 'communal', 'skirting', 'paintwork', 'soft furnishings',
  'frequency', 'date label'
]

// Simple text processing without natural library
function extractRelevantContent(content: string): string {
  // Split into sentences using simple regex
  const sentences = content
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10)
  
  // Process each sentence
  const processedSentences = sentences.map(sentence => {
    // Convert bullet points and numbered lists to consistent format
    return sentence
      .replace(/^[\s•\-\d]+\.?\s*/, '- ')  // Convert bullets/numbers to '-'
      .replace(/\([Ff]requency:?\s*([^)]+)\)/i, '(Frequency: $1)') // Standardize frequency format
      .trim()
  })
  
  // Score sentences based on relevance
  const sentenceScores = processedSentences.map((sentence) => {
    let score = 0
    const lowerSentence = sentence.toLowerCase()
    
    // Check for cleaning keywords
    CLEANING_KEYWORDS.forEach(keyword => {
      if (lowerSentence.includes(keyword)) {
        score += 2
      }
    })
    
    // Bonus points for important patterns
    if (
      /task|checklist|schedule/.test(lowerSentence) ||
      /^(area|room|date|type):/.test(lowerSentence) ||
      /\(frequency:/.test(lowerSentence) ||
      /^- /.test(sentence) || // Bullet points
      /(daily|weekly|monthly|quarterly|annually)/.test(lowerSentence)
    ) {
      score += 5
    }

    // Extra points for task descriptions
    if (/clean|dust|wipe|vacuum|mop|sanitize|polish|wash/.test(lowerSentence)) {
      score += 3
    }
    
    return { sentence, score }
  })
  
  // Sort by score and take most relevant
  const topSentences = sentenceScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 30) // Take top 30 most relevant sentences
    .sort((a, b) => 
      processedSentences.indexOf(a.sentence) - processedSentences.indexOf(b.sentence)
    )
  
  // Join sentences, preserving structure
  return topSentences
    .map(item => item.sentence)
    .join('\n')
}

async function processDocxFile(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import of mammoth for DOCX processing
    const mammoth = (await import('mammoth')).default
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch (error) {
    console.error('Error processing DOCX file:', error)
    throw new Error('Failed to extract text from DOCX file')
  }
}

async function processPdfFile(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import of pdf-parse for PDF processing
    const pdfParse = (await import('pdf-parse')).default
    const pdfData = await pdfParse(buffer)
    return pdfData.text
  } catch (error) {
    console.error('Error processing PDF file:', error)
    throw new Error('Failed to extract text from PDF file')
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if ("error" in auth) return auth.error

    // Rate limit per user: 3 requests per minute
    const rate = checkRateLimitByUserOrIp(request as any, 'process_document', 3, 60 * 1000, auth.user.email)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

    // Parse the incoming form data
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided or invalid file' }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
    }

    // Validate MIME type allowlist
    const ALLOWED_TYPES = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    ]
    if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Unsupported file type. Allowed: PDF, DOCX, or images.' }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Validate magic bytes match claimed MIME type
    if (file.type === 'application/pdf' && !(buffer.length >= 4 && buffer.subarray(0, 4).toString() === '%PDF')) {
      return NextResponse.json({ error: 'File content does not match PDF format' }, { status: 400 })
    }
    if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
        !(buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04)) {
      return NextResponse.json({ error: 'File content does not match DOCX format' }, { status: 400 })
    }
    if (file.type.startsWith('image/')) {
      const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47
      const isGif = buffer.subarray(0, 3).toString() === 'GIF'
      const isWebp = buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
      if (!isJpeg && !isPng && !isGif && !isWebp) {
        return NextResponse.json({ error: 'File content does not match a supported image format' }, { status: 400 })
      }
    }

    const asyncMode = request.headers.get('x-async') === 'true' ||
      request.nextUrl.searchParams.get('async') === 'true'

    if (asyncMode) {
      const { createDocumentJob, queueDocumentJob } = await import('@/lib/document-jobs')
      const jobId = await createDocumentJob({
        userId: auth.user.id,
        fileName: file.name,
        fileType: file.type,
        buffer,
      })
      queueDocumentJob(jobId, request.headers.get('Cookie') || undefined)
      return NextResponse.json({ jobId, status: 'PENDING' }, { status: 202 })
    }

    let content: string = ''
    let processingMethod: string = ''

    // Process based on file type
    if (file.type === 'application/pdf') {
      console.log('Processing PDF with OCR method...')
      processingMethod = 'OCR'
      content = await processPdfFile(buffer)
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      console.log('Processing DOCX with text extraction + NLP method...')
      processingMethod = 'Text Extraction + NLP'
      
      // Extract text directly from DOCX
      const rawText = await processDocxFile(buffer)
      
      // Apply NLP processing to extract relevant content
      content = extractRelevantContent(rawText)
      
      console.log('Raw text length:', rawText.length)
      console.log('Processed content length:', content.length)
    } else if (file.type.startsWith('image/')) {
      const { client, model, supportsVision } = getAIClient()

      if (!supportsVision) {
        console.log('Processing image with Tesseract OCR...')
        processingMethod = 'OCR (Tesseract)'

        // Local provider: OCR the image and feed the text through the existing
        // text prompt path. Empty OCR text fails via the "no content" check below.
        content = (await ocrImageToText(buffer)).trim()
      } else {
        console.log('Processing image with Vision API...')
        processingMethod = 'Vision API'

        // Process image
        const imageBuffer = await sharp(buffer)
          .resize(1024, 1024, { fit: 'inside' })
          .toBuffer()

        const base64Image = imageBuffer.toString('base64')

        // Use Vision API for image
        const visionResponse = await client.chat.completions.create({
          model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract cleaning tasks from this image. Format each task with its description, frequency, and estimated duration."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${file.type};base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 1500
        })

        content = visionResponse.choices[0]?.message?.content || ''
      }
    } else {
      return NextResponse.json({ 
        error: 'Unsupported file type. Please upload PDF, DOCX, or image files.' 
      }, { status: 400 })
    }

    if (!content.trim()) {
      return NextResponse.json({ 
        error: 'No content could be extracted from the file' 
      }, { status: 400 })
    }

    console.log('Extracted content preview:', content.substring(0, 200) + '...')

    // Internal call to AI schedule endpoint — forward only the session cookie
    const cookies = request.headers.get('Cookie') || ''
    const sessionCookie = cookies.split(';').find(c => c.trim().startsWith('next-auth.session-token='))?.trim() || ''
    const aiScheduleResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:4040'}/api/ai/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
      },
      body: JSON.stringify({ content })
    })

    const aiScheduleData = await aiScheduleResponse.json()

    if (!aiScheduleResponse.ok) {
      throw new Error(aiScheduleData.error || 'Failed to process content with AI')
    }

    // Return the enhanced AI results
    return NextResponse.json({
      success: true,
      processingMethod,
      tasksExtracted: aiScheduleData.schedule.tasks.length,
      schedule: aiScheduleData.schedule,
      processingInfo: aiScheduleData.processingInfo,
      metadata: {
        filename: file.name,
        fileType: file.type,
        fileSize: file.size,
        processingMethod,
        enhancedProcessing: true
      }
    })

  } catch (error) {
    if (error instanceof OcrBusyError) {
      return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': '15' } })
    }
    if (error instanceof OcrUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    console.error('Error processing document:', error)
    return NextResponse.json({
      error: 'Failed to process document'
    }, { status: 500 })
  }
}

// Handle OPTIONS preflight request
export async function OPTIONS(request: NextRequest) {
  const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || process.env.NEXTAUTH_URL || 'http://localhost:4040'
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    },
  })
}

// Handle GET requests
export async function GET() {
  const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || process.env.NEXTAUTH_URL || 'http://localhost:4040'
  return new NextResponse("Method not allowed", {
    status: 405,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    }
  })
}
