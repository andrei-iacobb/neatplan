const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

function calculateNextDueDate(frequency, startDate = new Date()) {
  const nextDue = new Date(startDate)
  
  switch (frequency) {
    case 'DAILY':
      nextDue.setDate(nextDue.getDate() + 1)
      break
    case 'WEEKLY':
      nextDue.setDate(nextDue.getDate() + 7)
      break
    case 'BIWEEKLY':
      nextDue.setDate(nextDue.getDate() + 14)
      break
    case 'MONTHLY':
      nextDue.setMonth(nextDue.getMonth() + 1)
      break
    case 'QUARTERLY':
      nextDue.setMonth(nextDue.getMonth() + 3)
      break
    case 'YEARLY':
      nextDue.setFullYear(nextDue.getFullYear() + 1)
      break
    default:
      // For CUSTOM or unknown, default to weekly
      nextDue.setDate(nextDue.getDate() + 7)
      break
  }
  
  return nextDue
}

async function markAllRoomsCleaned() {
  try {
    console.log('Marking all rooms as cleaned today...')
    
    const now = new Date()
    
    // Get all room schedules
    const roomSchedules = await prisma.roomSchedule.findMany({
      include: {
        room: true,
        schedule: true
      }
    })
    
    console.log(`Found ${roomSchedules.length} room schedules to update`)
    
    let updatedCount = 0
    let completionLogsCreated = 0
    
    // Process each room schedule
    for (const roomSchedule of roomSchedules) {
      const nextDue = calculateNextDueDate(roomSchedule.frequency, now)
      
      // Update the room schedule
      await prisma.roomSchedule.update({
        where: {
          id: roomSchedule.id
        },
        data: {
          status: 'COMPLETED',
          lastCompleted: now,
          nextDue: nextDue,
          updatedAt: now
        }
      })
      
      // Create completion log
      await prisma.roomScheduleCompletionLog.create({
        data: {
          roomScheduleId: roomSchedule.id,
          completedAt: now,
          notes: 'Marked as completed via bulk script - all rooms cleaned today',
          completedTasks: JSON.stringify([])
        }
      })
      
      updatedCount++
      completionLogsCreated++
      
      console.log(`✅ ${roomSchedule.room.name} (${roomSchedule.frequency}) - Next due: ${nextDue.toLocaleDateString()}`)
    }
    
    console.log(`\n🎉 Successfully marked ${updatedCount} room schedules as completed!`)
    console.log(`📝 Created ${completionLogsCreated} completion logs`)
    
    // Show summary statistics
    const schedulesByStatus = await prisma.roomSchedule.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    })
    
    console.log('\n📊 Updated schedule status distribution:')
    schedulesByStatus.forEach(group => {
      console.log(`   ${group.status}: ${group._count.id} schedules`)
    })
    
    // Show breakdown by frequency for next due dates
    const schedulesByFrequency = await prisma.roomSchedule.groupBy({
      by: ['frequency'],
      _count: {
        id: true
      }
    })
    
    console.log('\n📅 Schedules by frequency:')
    schedulesByFrequency.forEach(group => {
      console.log(`   ${group.frequency}: ${group._count.id} schedules`)
    })
    
    // Show when the next cleanings are due
    const nextDueDates = await prisma.roomSchedule.findMany({
      select: {
        nextDue: true,
        frequency: true,
        room: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        nextDue: 'asc'
      },
      take: 10
    })
    
    console.log('\n🔜 Next 10 cleanings due:')
    nextDueDates.forEach(schedule => {
      console.log(`   ${schedule.room.name} (${schedule.frequency}) - ${schedule.nextDue.toLocaleDateString()}`)
    })
    
  } catch (error) {
    console.error('❌ Error marking rooms as cleaned:', error)
  } finally {
    await prisma.$disconnect()
  }
}

markAllRoomsCleaned() 