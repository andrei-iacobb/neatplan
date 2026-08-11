import { prisma } from '../src/lib/db'

async function testAIFrequencies() {
  try {
    console.log('Testing AI frequency detection and mapping...')
    
    // Get schedules with detected frequencies
    const schedules = await prisma.schedule.findMany({
      select: {
        id: true,
        title: true,
        detectedFrequency: true,
        suggestedFrequency: true,
        tasks: {
          select: {
            description: true,
            frequency: true
          }
        }
      }
    })
    
    console.log(`\nFound ${schedules.length} schedules:\n`)
    
    schedules.forEach((schedule, index) => {
      console.log(`${index + 1}. ${schedule.title}`)
      console.log(`   📝 Detected Frequency: ${schedule.detectedFrequency || 'None'}`)
      console.log(`   🔄 Suggested Frequency: ${schedule.suggestedFrequency || 'None'}`)
      console.log(`   📋 Tasks: ${schedule.tasks.length}`)
      
      if (schedule.tasks.length > 0) {
        console.log(`   Task Frequencies:`)
        schedule.tasks.forEach((task) => {
          if (task.frequency) {
            console.log(`     - ${task.description.substring(0, 50)}... (${task.frequency})`)
          }
        })
      }
      console.log('')
    })
    
    // Test room assignments with auto-frequency
    console.log('Testing room assignments with auto-frequency...')
    
    const rooms = await prisma.room.findMany({
      take: 2,
      select: {
        id: true,
        name: true
      }
    })
    
    console.log(`Found ${rooms.length} rooms for testing`)
    
    // Find a schedule with suggested frequency
    const scheduleWithFreq = schedules.find(s => s.suggestedFrequency)
    
    if (scheduleWithFreq && rooms.length > 0) {
      console.log(`\nTesting assignment of "${scheduleWithFreq.title}" to "${rooms[0].name}"`)
      console.log(`This should use suggested frequency: ${scheduleWithFreq.suggestedFrequency}`)
      
      // Check if already assigned
      const existing = await prisma.roomSchedule.findUnique({
        where: {
          roomId_scheduleId: {
            roomId: rooms[0].id,
            scheduleId: scheduleWithFreq.id
          }
        }
      })
      
      if (existing) {
        console.log('✅ Already assigned with frequency:', existing.frequency)
      } else {
        console.log('⏳ Assignment would happen here (not actually assigning in test)')
      }
    } else {
      console.log('⚠️  No schedule with suggested frequency found for testing')
    }
    
  } catch (error) {
    console.error('❌ Error testing AI frequencies:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testAIFrequencies()
