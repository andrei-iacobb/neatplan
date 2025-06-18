import { NextRequest, NextResponse } from 'next/server'

// Force dynamic behavior for the API route
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes timeout
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

export async function POST(request: NextRequest) {
  if (request.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    // Parse the incoming form data
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided or invalid file' }, { status: 400 })
    }

    console.log('Extracting content from:', file.name, 'type:', file.type)

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let content: string = ''

    // Process based on file type
    if (file.type === 'application/pdf') {
      console.log('Extracting from PDF...')
      content = await processPdfFile(buffer)
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      console.log('Extracting from DOCX...')
      
      // Extract text directly from DOCX
      const rawText = await processDocxFile(buffer)
      
      // Apply NLP processing to extract relevant content
      content = extractRelevantContent(rawText)
      
      console.log('Raw text length:', rawText.length)
      console.log('Processed content length:', content.length)
    } else {
      return NextResponse.json({ 
        error: 'Unsupported file type. Please upload PDF or DOCX files.' 
      }, { status: 400 })
    }

    if (!content.trim()) {
      return NextResponse.json({ 
        error: 'No content could be extracted from the file' 
      }, { status: 400 })
    }

    console.log('Content extracted successfully from:', file.name)

    return NextResponse.json({
      success: true,
      content,
      metadata: {
        filename: file.name,
        fileType: file.type,
        fileSize: file.size,
        contentLength: content.length
      }
    })

  } catch (error) {
    console.error('Error extracting content:', error)
    return NextResponse.json({
      error: 'Failed to extract content',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Handle OPTIONS preflight request
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
} 