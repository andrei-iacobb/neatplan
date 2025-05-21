import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const tasks = await prisma.cleaningTask.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Error fetching cleaning tasks:', error)
    return NextResponse.json(
      { error: 'Error fetching cleaning tasks' },
      { status: 500 }
    )
  }
} 