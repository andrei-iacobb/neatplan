import { NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/db'
import * as z from 'zod'
import { checkRateLimitByIp } from '@/lib/rate-limit'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export async function POST(req: Request) {
  try {
    // Per-IP rate limit: 10 attempts per 10 minutes on login
    const rate = checkRateLimitByIp(req as any, 'auth_login', 10, 10 * 60 * 1000)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

    const body = await req.json()
    const { email, password } = loginSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // If user is blocked, allow login only if we are within the temporaryUnblockUntil window
    if (user.isBlocked) {
      const now = new Date()
      if (!user.temporaryUnblockUntil || now > user.temporaryUnblockUntil) {
        return NextResponse.json(
          { error: 'Account is blocked. Please contact an administrator.' },
          { status: 423 }
        )
      }
    }

    const isPasswordValid = await compare(password, user.password)

    if (!isPasswordValid) {
      // Increment failed login count and set last failed time; if too many fails, block
      const now = new Date()
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: { increment: 1 },
          lastFailedLoginAt: now,
        },
        select: { failedLoginCount: true }
      })

      // Lock after 5 consecutive failures within 15 minutes
      if ((updated.failedLoginCount ?? 0) >= 5) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            isBlocked: true,
          }
        })
      }

      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    // Reset failed login counter on success
    if (user.failedLoginCount && user.failedLoginCount > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lastFailedLoginAt: null }
      })
    }

    // If forcePasswordChange is set, return flag so frontend can redirect to change password
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        forcePasswordChange: user.forcePasswordChange === true,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
} 