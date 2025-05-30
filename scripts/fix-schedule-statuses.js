const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function fixScheduleStatuses() {
  try {
    console.log('Fixing schedule statuses...')
    
    const now = new Date()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago
    
    // Update completed schedules that are now due again
    const duePendingResult = await prisma.roomSchedule.updateMany({
      where: {
        status: 'COMPLETED',
        nextDue: {
          lte: now
        }
      },
      data: {
        status: 'PENDING'
      }
    })
    
    console.log(`Updated ${duePendingResult.count} completed schedules to pending (due again)`)
    
    // Update pending schedules that are overdue (24+ hours past due)
    const overdueResult = await prisma.roomSchedule.updateMany({
      where: {
        status: 'PENDING',
        nextDue: {
          lt: twentyFourHoursAgo // Only overdue if 24+ hours past due
        }
      },
      data: {
        status: 'OVERDUE'
      }
    })
    
    console.log(`Updated ${overdueResult.count} pending schedules to overdue (24+ hours past due)`)
    
    // Fix any schedules that were incorrectly set to PENDING immediately after completion
    // (if they have a recent completion and nextDue is in the future, mark as COMPLETED)
    const recentCompleted = await prisma.roomSchedule.updateMany({
      where: {
        status: 'PENDING',
        nextDue: {
          gt: now
        },
        lastCompleted: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      data: {
        status: 'COMPLETED'
      }
    })
    
    console.log(`Fixed ${recentCompleted.count} incorrectly pending schedules back to completed`)
    
    console.log('Schedule statuses fixed successfully!')
  } catch (error) {
    console.error('Error fixing schedule statuses:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixScheduleStatuses() 