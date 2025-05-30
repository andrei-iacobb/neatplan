import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma } from '@/lib/db'
import sharp from 'sharp'
import natural from 'natural'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Initialize NLP tools
const tokenizer = new natural.WordTokenizer()
const sentenceTokenizer = new natural.SentenceTokenizer(['en'])

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

function extractRelevantContent(content: string): string {
  // Tokenize into sentences
  const sentences = sentenceTokenizer.tokenize(content)
  
  // Initialize TF-IDF
  const tfidf = new natural.TfIdf()
  
  // Process each sentence
  const processedSentences = sentences.map(sentence => {
    // Convert bullet points and numbered lists to consistent format
    return sentence
      .replace(/^[\s•\-\d]+\.?\s*/, '- ')  // Convert bullets/numbers to '-'
      .replace(/\([Ff]requency:?\s*([^)]+)\)/i, '(Frequency: $1)') // Standardize frequency format
      .trim()
  })

  // Add each processed sentence as a document
  processedSentences.forEach(sentence => {
    tfidf.addDocument(sentence.toLowerCase())
  })
  
  // Score sentences based on relevance
  const sentenceScores = processedSentences.map((sentence, idx) => {
    let score = 0
    
    // Calculate TF-IDF score for cleaning keywords
    CLEANING_KEYWORDS.forEach(keyword => {
      tfidf.tfidfs(keyword, (docIndex, measure) => {
        if (docIndex === idx) {
          score += measure
        }
      })
    })
    
    // Bonus points for important patterns
    const lowerSentence = sentence.toLowerCase()
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

    console.log('Processing file:', file.name, 'type:', file.type)

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

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
      console.log('Processing image with Vision API...')
      processingMethod = 'Vision API'
      
      // Process image
      const imageBuffer = await sharp(buffer)
        .resize(1024, 1024, { fit: 'inside' })
        .toBuffer()
      
      const base64Image = imageBuffer.toString('base64')
      
      // Use Vision API for image
      const visionResponse = await openai.chat.completions.create({
        model: "gpt-4-vision-preview",
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

    // Process content with OpenAI to extract structured tasks
    const completion = await openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: [
        {
          role: "system",
          content: `You are a specialist assistant for care home cleaning compliance. Extract a structured list of cleaning tasks from the provided content.

For each task, provide:
- Task description (clear and specific)
- Frequency (daily/weekly/monthly/quarterly/as-needed)
- Estimated duration (in minutes or hours)
- Room/area (if specified)

Format your response as a JSON array of objects with the following structure:
[
  {
    "taskDescription": "string",
    "frequency": "string", 
    "estimatedDuration": "string",
    "area": "string or null"
  }
]

Only extract actual cleaning tasks. Ignore headers, instructions, or irrelevant content.`
        },
        {
          role: "user",
          content: `Please extract cleaning tasks from this content (processed using ${processingMethod}):\n\n${content}`
        }
      ],
      temperature: 0.3
    })

    const aiResponse = completion.choices[0]?.message?.content || ''
    console.log('AI Response:', aiResponse)

    // Parse JSON response
    let tasks: any[] = []
    try {
      tasks = JSON.parse(aiResponse)
      if (!Array.isArray(tasks)) {
        throw new Error('Response is not an array')
      }
    } catch (parseError) {
      console.error('Error parsing AI response as JSON:', parseError)
      
      // Fallback: try to extract tasks from text format
      const lines = aiResponse.split('\n').filter(line => line.trim())
      tasks = lines.map(line => ({
        taskDescription: line.trim(),
        frequency: 'daily',
        estimatedDuration: '30 minutes',
        area: null
      }))
    }

    // Validate and clean tasks
    const validTasks = tasks
      .filter(task => task.taskDescription && task.taskDescription.trim().length > 0)
      .map(task => ({
        taskDescription: task.taskDescription.trim(),
        frequency: task.frequency || 'daily',
        estimatedDuration: task.estimatedDuration || '30 minutes',
        area: task.area || null
      }))

    if (validTasks.length === 0) {
      return NextResponse.json({ 
        error: 'No valid cleaning tasks could be extracted from the document' 
      }, { status: 400 })
    }

    // Save tasks to database
    const createdTasks = await Promise.all(
      validTasks.map(task =>
        prisma.cleaningTask.create({
          data: {
            taskDescription: task.taskDescription,
            frequency: task.frequency,
            estimatedDuration: task.estimatedDuration,
            status: "pending"
          }
        })
      )
    )

    return NextResponse.json({
      success: true,
      processingMethod,
      tasksExtracted: createdTasks.length,
      tasks: createdTasks,
      metadata: {
        filename: file.name,
        fileType: file.type,
        fileSize: file.size,
        processingMethod
      }
    })

  } catch (error) {
    console.error('Error processing document:', error)
    return NextResponse.json({
      error: 'Failed to process document',
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

// Handle GET requests
export async function GET() {
  return new NextResponse("Method not allowed", { 
    status: 405,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}