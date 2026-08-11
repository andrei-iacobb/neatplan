import { prisma } from '../src/lib/db'
import { UserRole } from '../src/generated/prisma/enums'

async function updateUserRoles() {
  try {
    console.log('Updating user roles...')
    
    // Update admin users
    const adminResult = await prisma.user.updateMany({
      where: { isAdmin: true },
      data: { role: UserRole.OP }
    })
    
    console.log(`Updated ${adminResult.count} admin users`)
    
    // Update cleaner users
    const cleanerResult = await prisma.user.updateMany({
      where: { isAdmin: false },
      data: { role: UserRole.CLEANER }
    })
    
    console.log(`Updated ${cleanerResult.count} cleaner users`)
    
    console.log('User roles updated successfully!')
  } catch (error) {
    console.error('Error updating user roles:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateUserRoles()
