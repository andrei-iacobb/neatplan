const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function makeTasksDueToday() {
  try {
    console.log('Making all cleaning tasks due today...')
    
    const today = new Date()
    today.setHours(12, 0, 0, 0) // Set to noon today to ensure it's clearly "today"
    
    // Update all room schedules to be due today and set status to PENDING
    const result = await prisma.roomSchedule.updateMany({
      where: {
        // Update all schedules regardless of current status
      },
      data: {
        nextDue: today,
        status: 'PENDING',
        lastCompleted: null // Clear last completed to make them fresh
      }
    })
    
    console.log(`✅ Successfully updated ${result.count} room schedules to be due today!`)
    
    // Show some stats
    const schedulesByStatus = await prisma.roomSchedule.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    })
    
    console.log('\n📊 Current schedule status distribution:')
    schedulesByStatus.forEach(group => {
      console.log(`   ${group.status}: ${group._count.id} schedules`)
    })
    
    // Show rooms that will appear in cleaner dashboard
    const roomsWithPendingSchedules = await prisma.room.findMany({
      where: {
        schedules: {
          some: {
            status: 'PENDING'
          }
        }
      },
      include: {
        schedules: {
          where: {
            status: 'PENDING'
          },
          include: {
            schedule: {
              select: {
                title: true,
                tasks: true
              }
            }
          }
        }
      }
    })
    
    console.log(`\n🏠 ${roomsWithPendingSchedules.length} rooms will appear in cleaner dashboard`)
    console.log('📋 Total pending tasks:', roomsWithPendingSchedules.reduce((total, room) => {
      return total + room.schedules.reduce((roomTotal, schedule) => {
        return roomTotal + schedule.schedule.tasks.length
      }, 0)
    }, 0))
    
  } catch (error) {
    console.error('❌ Error making tasks due today:', error)
  } finally {
    await prisma.$disconnect()
  }
}

makeTasksDueToday() 