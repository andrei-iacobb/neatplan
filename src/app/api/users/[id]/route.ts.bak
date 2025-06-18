import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { name, email, password, isAdmin } = body

    let dataToUpdate: any = { name, email, isAdmin }

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
  { params }: { params: { id: string } }
) {
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