import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/db'
import { sign } from 'jsonwebtoken'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Find the user to switch to
    const targetUser = await prisma.user.findUnique({
      where: { email }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Create a new JWT token for the target user
    const token = {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role: (targetUser as any).role,
      isAdmin: targetUser.isAdmin,
      sub: targetUser.id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
    }

    const jwtToken = sign(token, process.env.NEXTAUTH_SECRET!)

    // Set the session cookie
    const response = NextResponse.json({ 
      success: true, 
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: (targetUser as any).role,
        isAdmin: targetUser.isAdmin
      }
    })

    // Set the session token cookie
    response.cookies.set('next-auth.session-token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/'
    })

    return response
  } catch (error) {
    console.error('Error switching account:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 