import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, sessionToken } = body

    if (action === 'update_activity') {
      // Update last activity for active session
      await prisma.userSession.updateMany({
        where: {
          userId: session.user.id,
          isActive: true,
          sessionToken: sessionToken || undefined
        },
        data: {
          lastActivity: new Date()
        }
      })
      
      return NextResponse.json({ success: true })
    }

    if (action === 'logout') {
      // Mark session as logged out
      await prisma.userSession.updateMany({
        where: {
          userId: session.user.id,
          isActive: true,
          sessionToken: sessionToken || undefined
        },
        data: {
          logoutAt: new Date(),
          isActive: false
        }
      })
      
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Session tracking error:', error)
    return NextResponse.json(
      { error: 'Failed to update session tracking' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }

    // Get recent sessions for admin dashboard
    const recentSessions = await prisma.userSession.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            isAdmin: true
          }
        }
      },
      orderBy: {
        lastActivity: 'desc'
      },
      take: 10
    })

    return NextResponse.json(recentSessions)

  } catch (error) {
    console.error('Error fetching session data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session data' },
      { status: 500 }
    )
  }
} 