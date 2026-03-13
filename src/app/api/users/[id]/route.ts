import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { name, email, password, isAdmin, isBlocked, forcePasswordChange } = body

    // Prevent admin from modifying their own admin/blocked status
    if (session.user.id === id) {
      if (isAdmin !== undefined || isBlocked !== undefined) {
        return NextResponse.json({ error: 'Cannot modify your own admin or blocked status' }, { status: 403 })
      }
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }
    }

    // Validate password strength if provided
    if (password && (typeof password !== 'string' || password.length < 8)) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    // Validate name length if provided
    if (name && (typeof name !== 'string' || name.length > 200)) {
      return NextResponse.json({ error: 'Name must be 200 characters or less' }, { status: 400 })
    }

    const dataToUpdate: Record<string, unknown> = {}
    if (name !== undefined) dataToUpdate.name = name
    if (email !== undefined) dataToUpdate.email = email
    if (isAdmin !== undefined) dataToUpdate.isAdmin = Boolean(isAdmin)
    if (isBlocked !== undefined) dataToUpdate.isBlocked = Boolean(isBlocked)
    if (forcePasswordChange !== undefined) dataToUpdate.forcePasswordChange = Boolean(forcePasswordChange)

    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, 12)
    }

    const user = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    })

    const { password: _, ...userWithoutPassword } = user
    return NextResponse.json(userWithoutPassword)

  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    
    // Prevent admin from deleting themselves
    if (session.user.id === id) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 403 })
    }

    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'User deleted successfully' })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
} 