import { prisma } from '../src/lib/db'

async function completeSomeRooms() {
  try {
    console.log('Completing some ground floor rooms for testing...')
    
    // Get some ground floor rooms to complete
    const groundFloorRooms = await prisma.room.findMany({
      where: {
        floor: 'Ground Floor'
      },
      include: {
        schedules: {
          where: {
            status: 'PENDING'
          }
        }
      },
      take: 5 // Complete 5 rooms
    })
    
    console.log(`Found ${groundFloorRooms.length} ground floor rooms to complete`)
    
    const now = new Date()
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7) // Set next due to a week from now
    
    // Complete the schedules for these rooms
    let completedCount = 0
    
    for (const room of groundFloorRooms) {
      for (const schedule of room.schedules) {
        await prisma.roomSchedule.update({
          where: {
            id: schedule.id
          },
          data: {
            status: 'COMPLETED',
            lastCompleted: now,
            nextDue: nextWeek
          }
        })
        
        // Create completion log
        await prisma.roomScheduleCompletionLog.create({
          data: {
            roomScheduleId: schedule.id,
            completedAt: now,
            notes: 'Completed via test script'
          }
        })
        
        completedCount++
      }
    }
    
    console.log(`✅ Successfully completed ${completedCount} schedules for ${groundFloorRooms.length} rooms!`)
    
    // Show current status distribution
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
    
    // Show breakdown by priority
    const overdueRooms = await prisma.room.count({
      where: {
        schedules: {
          some: {
            status: 'OVERDUE'
          }
        }
      }
    })
    
    const pendingRooms = await prisma.room.count({
      where: {
        schedules: {
          some: {
            status: 'PENDING'
          }
        }
      }
    })
    
    const completedRooms = await prisma.room.count({
      where: {
        schedules: {
          some: {
            status: 'COMPLETED'
          }
        }
      }
    })
    
    console.log('\n🏠 Room status breakdown:')
    console.log(`   🚨 Overdue: ${overdueRooms} rooms`)
    console.log(`   ⏰ Pending: ${pendingRooms} rooms`)
    console.log(`   ✅ Completed: ${completedRooms} rooms`)
    
    console.log('\n🎯 Perfect for testing completed rooms section!')
    
  } catch (error) {
    console.error('❌ Error completing rooms:', error)
  } finally {
    await prisma.$disconnect()
  }
}

completeSomeRooms()
