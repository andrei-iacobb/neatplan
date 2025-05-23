import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { getServerSession } from 'next-auth'
import natural from 'natural'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
// Initialize NLP tools
  const tokenizer = new natural.WordTokenizer()
  const sentenceTokenizer = new natural.SentenceTokenizer(['en'])

const SYSTEM_PROMPT = `You are a specialist assistant for care home cleaning compliance. Extract a structured cleaning schedule from a provided checklist or cleaning document.

Instructions:
1. Identify and extract the **schedule title** (e.g. "Deep Cleaning Checklist")
2. Determine the **type of cleaning** (e.g. Deep Clean, Routine Clean, Infection Control Clean)
3. Extract the **main frequency** (e.g. quarterly, after vacancy, post-infection)
4. Note the **target areas** (e.g. rooms, communal spaces, bathrooms)
5. Extract a clear list of **cleaning tasks**, and for each task:
   - Format as a bullet point
   - Add any specific frequency (if different from the main one)
   - Include any relevant special instructions (e.g. "remove radiator cover", "label under seat")

Format your output like this:

Title: [Extracted Title]
Type: [Type of Clean]
Frequency: [Main frequency or "Not specified"]
Area: [Mentioned location or "General"]

Tasks:
- [Task description] (Frequency: [if given])
  Additional notes: [optional instructions]
- ...
`

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

    // Extract relevant content using NLP
    const processedContent = extractRelevantContent(content)

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: processedContent }
      ],
      temperature: 0.3, // Lower temperature for more consistent output
    })

    const result = completion.choices[0].message?.content

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to generate schedule' },
        { status: 500 }
      )
    }

    // Parse the result
    const lines = result.split('\n')
    const titleMatch = lines.find(line => line.startsWith('Title:'))?.replace('Title:', '').trim() || 'Cleaning Schedule'
    const typeMatch = lines.find(line => line.startsWith('Type:'))?.replace('Type:', '').trim()
    const frequencyMatch = lines.find(line => line.startsWith('Frequency:'))?.replace('Frequency:', '').trim()
    const areaMatch = lines.find(line => line.startsWith('Area:'))?.replace('Area:', '').trim()

    // Construct title with fallbacks
    const titleParts = []
    if (titleMatch && titleMatch !== 'undefined' && titleMatch !== 'null') titleParts.push(titleMatch)
    if (typeMatch && typeMatch !== 'undefined' && typeMatch !== 'null') titleParts.push(typeMatch)
    if (areaMatch && areaMatch !== 'undefined' && areaMatch !== 'null') titleParts.push(areaMatch)
    
    const title = titleParts.length > 0 ? titleParts.join(' - ') : 'Cleaning Schedule'
    
    // Find tasks section
    const tasksStartIndex = lines.findIndex(line => line.trim() === 'Tasks:')
    if (tasksStartIndex === -1) {
      return NextResponse.json(
        { error: 'Failed to parse tasks from the generated schedule' },
        { status: 500 }
      )
    }

    const tasks = lines
      .slice(tasksStartIndex + 1)
      .filter(line => line.trim() && line.startsWith('-'))
      .map(line => {
        const [description, ...notes] = line.substring(1).split('\n  ')
        const frequencyMatch = description.match(/\(Frequency:\s*([^)]+)\)/)
        const taskDescription = description.replace(/\(Frequency:[^)]+\)/, '').trim()
        
        // Only create task if we have a valid description
        if (!taskDescription) return null

        return {
          description: taskDescription,
          frequency: frequencyMatch ? frequencyMatch[1].trim() : null,
          additionalNotes: notes.map(note => 
            note.replace(/^Additional notes:\s*/i, '').trim()
          ).filter(Boolean).join('\n') || null
        }
      })
      .filter((task): task is { description: string; frequency: string | null; additionalNotes: string | null } => 
        task !== null && typeof task.description === 'string'
      )

    if (tasks.length === 0) {
      return NextResponse.json(
        { error: 'No valid tasks found in the generated schedule' },
        { status: 500 }
      )
    }

    // Save to database
    const schedule = await prisma.schedule.create({
      data: {
        title,
        tasks: {
          create: tasks
        }
      },
      include: {
        tasks: true
      }
    })

    return NextResponse.json({ result, schedule })
  } catch (error: any) {
    console.error('Error processing schedule:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to process request' },
      { status: 500 }
    )
  }
} 