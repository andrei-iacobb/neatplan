import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { email, sessionToken } = await request.json()

    if (!email || !sessionToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Find the target user
    const targetUser = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isAdmin: true
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Return the user data for session update
    return NextResponse.json({
      success: true,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        isAdmin: targetUser.isAdmin
      }
    })

  } catch (error) {
    console.error('Switch account error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 