import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma } from '@/lib/db'
import sharp from 'sharp'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Force dynamic behavior for the API route
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes timeout

// Define allowed methods
export const runtime = 'nodejs'

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

    // Process based on file type
    if (file.type === 'application/pdf') {
      // Dynamic import of pdf-parse
      const pdfParse = (await import('pdf-parse')).default
      const pdfData = await pdfParse(buffer)
      content = pdfData.text
    } else if (file.type.startsWith('image/')) {
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
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    // Process content with OpenAI to extract tasks
    const completion = await openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: [
        {
          role: "system",
          content: "Extract cleaning tasks from the following text. For each task, provide:\n- Task description\n- Frequency (daily/weekly/monthly)\n- Estimated duration"
        },
        {
          role: "user",
          content: content
        }
      ],
      temperature: 0
    })

    const aiResponse = completion.choices[0]?.message?.content || ''
    console.log('AI Response:', aiResponse)

    // Parse tasks from AI response
    const tasks = aiResponse.split('\n').filter(line => line.trim()).map(line => {
      const task = {
        taskDescription: line.trim(),
        frequency: 'daily',
        estimatedDuration: '30min'
      }
      return task
    })

    // Save tasks to database
    const createdTasks = await Promise.all(
      tasks.map(task =>
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
      tasks: createdTasks
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