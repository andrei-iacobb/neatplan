const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function makeUpstairsDueYesterday() {
  try {
    console.log('Making all upstairs rooms due yesterday...')
    
    // Get yesterday's date (more than 24 hours ago to trigger OVERDUE)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(12, 0, 0, 0) // Set to noon yesterday
    
    // Find all upstairs rooms
    const upstairsRooms = await prisma.room.findMany({
      where: {
        floor: 'Upstairs'
      },
      include: {
        schedules: true
      }
    })
    
    console.log(`Found ${upstairsRooms.length} upstairs rooms`)
    
    // Update all schedules for upstairs rooms
    const upstairsRoomIds = upstairsRooms.map(room => room.id)
    
    const result = await prisma.roomSchedule.updateMany({
      where: {
        roomId: {
          in: upstairsRoomIds
        }
      },
      data: {
        nextDue: yesterday,
        status: 'OVERDUE', // Set directly to overdue since it's past 24-hour grace period
        lastCompleted: null // Clear last completed to make them fresh
      }
    })
    
    console.log(`✅ Successfully updated ${result.count} upstairs room schedules to be due yesterday!`)
    
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
    
    // Show breakdown by floor
    const groundFloorRooms = await prisma.room.count({
      where: {
        floor: 'Ground Floor',
        schedules: {
          some: {
            status: 'PENDING'
          }
        }
      }
    })
    
    const upstairsOverdueRooms = await prisma.room.count({
      where: {
        floor: 'Upstairs',
        schedules: {
          some: {
            status: 'OVERDUE'
          }
        }
      }
    })
    
    console.log('\n🏠 Room status by floor:')
    console.log(`   Ground Floor: ${groundFloorRooms} rooms with PENDING tasks`)
    console.log(`   Upstairs: ${upstairsOverdueRooms} rooms with OVERDUE tasks`)
    
    // Count total tasks
    const totalOverdueTasks = await prisma.roomSchedule.count({
      where: {
        status: 'OVERDUE',
        room: {
          floor: 'Upstairs'
        }
      }
    })
    
    const totalPendingTasks = await prisma.roomSchedule.count({
      where: {
        status: 'PENDING',
        room: {
          floor: 'Ground Floor'
        }
      }
    })
    
    console.log('\n📋 Task breakdown:')
    console.log(`   OVERDUE (Upstairs): ${totalOverdueTasks} schedules`)
    console.log(`   PENDING (Ground Floor): ${totalPendingTasks} schedules`)
    
    console.log('\n🎯 Perfect for testing:')
    console.log('   - Cleaner dashboard will show overdue vs due today sections')
    console.log('   - Priority sorting will put overdue rooms first')
    console.log('   - 24-hour grace period system in action')
    
  } catch (error) {
    console.error('❌ Error making upstairs due yesterday:', error)
  } finally {
    await prisma.$disconnect()
  }
}

makeUpstairsDueYesterday() 