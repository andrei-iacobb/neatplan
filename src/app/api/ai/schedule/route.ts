import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getServerSession } from 'next-auth'
import { PrismaClient } from '@prisma/client'
import { getSchedulePrimaryFrequency, inferFrequencyFromTasks } from '@/lib/frequency-mapping'

const prisma = new PrismaClient()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Simple text processing without natural library

// Rough token estimation (1 token ≈ 4 characters)
const MAX_TOKENS_PER_REQUEST = 6000 // Leave room for system prompt and response
const CHARS_PER_TOKEN = 4

const TASK_EXTRACTION_PROMPT = `You are an expert at extracting cleaning tasks from documents. Extract ALL cleaning tasks from the provided content.

IMPORTANT: Look for tasks in these formats:
- Checkbox format: □ Task description
- Bullet points: • Task description  
- Numbered lists: 1. Task description
- Dash lists: - Task description
- Plain text tasks with cleaning verbs

Return a JSON array of tasks with this structure:
[
  {
    "description": "Clear task description",
    "frequency": "Task frequency if mentioned (daily, weekly, monthly, quarterly, etc.)",
    "estimatedDuration": "Duration if mentioned (e.g., '5 minutes', '10-15 minutes')",
    "area": "Room/area if specified (e.g., 'bedroom', 'bathroom')",
    "notes": "Any special instructions"
  }
]

Extract every single cleaning task, including:
- Cleaning actions: clean, wipe, dust, vacuum, hoover, mop, wash, sanitize, disinfect, polish, remove, empty, refill, replace
- Time estimates in parentheses: (5 minutes), (10-15 minutes)
- Frequencies mentioned: daily, weekly, monthly, quarterly, after vacancy, post-infection
- Special instructions and compliance notes
- Supply management: refill soap, empty bins, replace towels

EXAMPLE INPUT:
"□ Empty bins (5 minutes)
□ Clean toilet (10 minutes)"

EXAMPLE OUTPUT:
[
  {"description": "Empty bins", "estimatedDuration": "5 minutes", "frequency": null, "area": null, "notes": null},
  {"description": "Clean toilet", "estimatedDuration": "10 minutes", "frequency": null, "area": null, "notes": null}
]

Return ONLY the JSON array, no markdown or extra text.`

const ANALYSIS_PROMPT = `Analyze this cleaning document to extract metadata. Return JSON with this structure:

{
  "title": "Document title",
  "type": "Type of cleaning (Daily, Deep, Infection Control, Post Vacancy, etc.)",
  "frequency": "Main frequency (daily, weekly, monthly, quarterly, after vacancy, post-infection)",
  "area": "Target area (bedrooms, bathrooms, communal, general)"
}

Return ONLY valid JSON, no markdown.`

const ENHANCED_CLEANING_KEYWORDS = [
  // Actions
  'clean', 'wipe', 'dust', 'vacuum', 'hoover', 'mop', 'wash', 'shampoo', 'polish',
  'sanitize', 'disinfect', 'remove', 'empty', 'refill', 'replace', 'scrub', 'rinse',
  'damp dust', 'deep clean', 'spot clean', 'steam clean', 'pressure wash',
  
  // Frequencies  
  'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'yearly',
  'after vacancy', 'post vacancy', 'vacant', 'post infection', 'infection control',
  'as required', 'when needed', 'routine', 'regular', 'occasional',
  
  // Areas/Objects
  'floor', 'carpet', 'curtains', 'blinds', 'mirror', 'window', 'furniture',
  'wardrobe', 'cupboard', 'bed', 'chair', 'table', 'desk', 'surface',
  'radiator', 'frame', 'sink', 'toilet', 'commode', 'extractor', 'fan',
  'room', 'area', 'communal', 'skirting', 'paintwork', 'soft furnishings',
  'bathroom', 'bedroom', 'kitchen', 'office', 'lounge', 'dining',
  'doors', 'handles', 'light switches', 'fittings', 'fixtures',
  
  // Supplies/Equipment
  'soap dispenser', 'paper towels', 'toilet roll', 'bin', 'waste', 'trash',
  'cleaning products', 'disinfectant', 'bleach', 'detergent',
  
  // Compliance terms
  'checklist', 'schedule', 'compliance', 'infection control', 'health safety',
  'date label', 'sign', 'initial', 'completed', 'task', 'duty'
]

function enhancedContentExtraction(content: string): string {
  console.log('Starting enhanced content extraction...')
  
  // Clean and normalize the content
  let processedContent = content
    // Fix common OCR/encoding issues
    .replace(/\u0000/g, '') // Remove null characters
    .replace(/[""]/g, '"') // Normalize quotes
    .replace(/['']/g, "'") // Normalize apostrophes
    .replace(/\u00A0/g, ' ') // Replace non-breaking spaces
    .replace(/\t/g, ' ') // Replace tabs with spaces
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n')
    .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters that might be corrupted
    
  // Split into lines and process each one
  const lines = processedContent.split('\n')
  const relevantLines: string[] = []
  
  for (let line of lines) {
    line = line.trim()
    if (!line || line.length < 3) continue
    
    // Skip obviously corrupted lines (lots of special characters)
    if (/[^\w\s\-\.\(\)\[\]□☐✓,;:]/g.test(line) && line.replace(/[^\w\s\-\.\(\)\[\]□☐✓,;:]/g, '').length < line.length * 0.5) {
      continue
    }
    
    // Score each line for relevance
    let score = 0
    const lowerLine = line.toLowerCase()
    
    // Check for cleaning keywords
    ENHANCED_CLEANING_KEYWORDS.forEach(keyword => {
      if (lowerLine.includes(keyword)) {
        score += keyword.length / 4 // Longer keywords get more weight
      }
    })
    
    // Bonus points for structured content
    if (
      /^[\d\w\s]*\.?\s*(clean|wipe|dust|vacuum|mop|wash|sanitize|polish|remove|empty|refill)/i.test(line) ||
      /\(.*frequency.*\)/i.test(line) ||
      /\(.*minutes?\)/i.test(line) ||
      /^[\s•\-\d]+\.?\s*[A-Z]/i.test(line) || // Bullet points/numbered lists
      /(daily|weekly|monthly|quarterly)/i.test(line) ||
      /checklist|schedule|task|room|area/i.test(line) ||
      line.includes('□') || line.includes('☐') || line.includes('✓') // Checkboxes
    ) {
      score += 5
    }
    
    // Include lines with reasonable relevance scores
    if (score >= 2 || line.length < 100) { // Always include short lines
      relevantLines.push(line)
    }
  }
  
  // If we filtered out too much, include more content
  if (relevantLines.length < 10) {
    console.log('Too few relevant lines found, including more content')
    return lines.filter(line => line.trim().length > 3 && line.trim().length < 200).join('\n')
  }
  
  const result = relevantLines.join('\n')
  console.log(`Content extraction: ${lines.length} lines -> ${relevantLines.length} relevant lines`)
  
  return result
}

function smartChunkContent(content: string, maxCharsPerChunk: number): string[] {
  const lines = content.split('\n')
  const chunks: string[] = []
  let currentChunk = ''
  
  for (const line of lines) {
    // If adding this line would exceed the limit, start a new chunk
    if (currentChunk.length + line.length + 1 > maxCharsPerChunk && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = line
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks
}

function cleanJsonResponse(response: string): string {
  // Remove markdown code blocks if present
  let cleaned = response.replace(/```json\s*\n?/gi, '').replace(/```\s*$/gi, '')
  
  // Remove any leading/trailing whitespace
  cleaned = cleaned.trim()
  
  // Check if this is a JSON array or object
  const isArray = cleaned.startsWith('[')
  const isObject = cleaned.startsWith('{')
  
  if (isArray) {
    // For arrays, find the array bounds
    const arrayStart = cleaned.indexOf('[')
    const arrayEnd = cleaned.lastIndexOf(']')
    
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      cleaned = cleaned.substring(arrayStart, arrayEnd + 1)
    }
  } else if (isObject) {
    // For objects, find the object bounds
    const objectStart = cleaned.indexOf('{')
    const objectEnd = cleaned.lastIndexOf('}')
    
    if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
      cleaned = cleaned.substring(objectStart, objectEnd + 1)
    }
  }
  
  return cleaned
}

async function extractTasksFromChunk(chunk: string): Promise<any[]> {
  try {
    console.log('=== CHUNK PROCESSING DEBUG ===')
    console.log('Chunk length:', chunk.length)
    console.log('Chunk content preview:', chunk.substring(0, 500))
    console.log('================================')
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: TASK_EXTRACTION_PROMPT },
        { role: "user", content: chunk }
      ],
      temperature: 0.1,
      max_tokens: 1500
    })

    const result = completion.choices[0].message?.content
    console.log('=== AI RESPONSE DEBUG ===')
    console.log('Raw AI response:', result)
    console.log('==========================')
    
    if (!result) return []

    const cleanedResponse = cleanJsonResponse(result)
    console.log('=== CLEANED RESPONSE DEBUG ===')
    console.log('Cleaned response:', cleanedResponse)
    console.log('===============================')
    
    try {
      const tasks = JSON.parse(cleanedResponse)
      console.log('=== PARSED TASKS DEBUG ===')
      console.log('Parsed tasks:', JSON.stringify(tasks, null, 2))
      console.log('Is array:', Array.isArray(tasks))
      console.log('Length:', Array.isArray(tasks) ? tasks.length : 'N/A')
      console.log('===========================')
      
      return Array.isArray(tasks) ? tasks : []
    } catch (parseError) {
      console.error('=== JSON PARSE ERROR ===')
      console.error('Parse error:', parseError)
      console.error('Attempting to parse:', cleanedResponse)
      console.error('========================')
      return []
    }
  } catch (error) {
    console.error('Error extracting tasks from chunk:', error)
    return []
  }
}

async function analyzeDocumentMetadata(content: string): Promise<any> {
  try {
    // Use only the first part of the document for metadata (titles, headers, etc.)
    const metadataContent = content.substring(0, MAX_TOKENS_PER_REQUEST * CHARS_PER_TOKEN / 2)
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: metadataContent }
      ],
      temperature: 0.1,
      max_tokens: 500
    })

    const result = completion.choices[0].message?.content
    if (!result) return null

    const cleanedResponse = cleanJsonResponse(result)
    try {
      return JSON.parse(cleanedResponse)
    } catch {
      return null
    }
  } catch (error) {
    console.error('Error analyzing document metadata:', error)
    return null
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!openai.apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const { content } = await req.json()

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please provide file content' },
        { status: 400 }
      )
    }

    console.log('Processing content length:', content.length)

    // Enhanced content extraction
    const processedContent = enhancedContentExtraction(content)
    console.log('Processed content length:', processedContent.length)
    
    // Check if we need to chunk the content
    const maxCharsPerChunk = MAX_TOKENS_PER_REQUEST * CHARS_PER_TOKEN
    const needsChunking = processedContent.length > maxCharsPerChunk
    
    let allTasks: any[] = []
    
    if (needsChunking) {
      console.log('Content is large, processing in chunks...')
      const chunks = smartChunkContent(processedContent, maxCharsPerChunk)
      console.log(`Split into ${chunks.length} chunks`)
      
      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        console.log(`Processing chunk ${i + 1}/${chunks.length}...`)
        const chunkTasks = await extractTasksFromChunk(chunks[i])
        allTasks.push(...chunkTasks)
        
        // Small delay to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
    } else {
      console.log('Content fits in single request, processing normally...')
      allTasks = await extractTasksFromChunk(processedContent)
    }

    console.log(`Extracted ${allTasks.length} tasks total`)

    // Analyze document metadata separately
    console.log('Analyzing document metadata...')
    const metadata = await analyzeDocumentMetadata(processedContent)

    // Validate we got some tasks
    if (allTasks.length === 0) {
      return NextResponse.json(
        { error: 'No cleaning tasks could be extracted from the document' },
        { status: 500 }
      )
    }

    // Construct title from metadata
    const titleParts = []
    if (metadata?.title && metadata.title !== 'undefined') titleParts.push(metadata.title)
    if (metadata?.type && metadata.type !== 'undefined') titleParts.push(metadata.type)
    if (metadata?.area && metadata.area !== 'undefined' && metadata.area !== 'general') titleParts.push(metadata.area)
    
    const title = titleParts.length > 0 ? titleParts.join(' - ') : 'Cleaning Schedule'

    // Process tasks for database
    const tasks = allTasks
      .filter(task => task.description && task.description.length > 3)
      .map((task: any) => ({
        description: task.description || 'Cleaning task',
        frequency: task.frequency || null,
        additionalNotes: [task.notes, task.estimatedDuration, task.area]
          .filter(Boolean)
          .join(' | ') || null
      }))

    if (tasks.length === 0) {
      return NextResponse.json(
        { error: 'No valid tasks could be processed' },
        { status: 500 }
      )
    }

    // Determine frequencies
    const detectedFrequency = metadata?.frequency && metadata.frequency !== 'Not specified' 
      ? metadata.frequency : null
    const suggestedFrequency = detectedFrequency 
      ? getSchedulePrimaryFrequency(detectedFrequency)
      : inferFrequencyFromTasks(tasks)

    console.log('Creating schedule with detected frequency:', detectedFrequency, 'suggested:', suggestedFrequency)

    // Save to database
    const schedule = await prisma.schedule.create({
      data: {
        title,
        detectedFrequency,
        suggestedFrequency,
        tasks: {
          create: tasks
        }
      } as any,
      include: {
        tasks: true
      }
    })

    console.log('Schedule created successfully:', schedule.id)

    return NextResponse.json({ 
      result: `Successfully extracted ${tasks.length} cleaning tasks using ${needsChunking ? 'multi-chunk' : 'single'} processing`,
      schedule,
      processingInfo: {
        originalLength: content.length,
        processedLength: processedContent.length,
        chunksUsed: needsChunking ? smartChunkContent(processedContent, maxCharsPerChunk).length : 1,
        tasksExtracted: tasks.length
      },
      metadata
    })
  } catch (error: any) {
    console.error('Error processing schedule:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to process request' },
      { status: 500 }
    )
  }
} 