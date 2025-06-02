const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// Simple frequency mapping function
function mapFrequencyToEnum(frequencyString) {
  if (!frequencyString) return 'WEEKLY'
  
  const frequency = frequencyString.toLowerCase().trim()
  
  if (frequency.includes('daily')) return 'DAILY'
  if (frequency.includes('weekly')) return 'WEEKLY'
  if (frequency.includes('bi-weekly') || frequency.includes('biweekly')) return 'BIWEEKLY'
  if (frequency.includes('monthly')) return 'MONTHLY'
  if (frequency.includes('quarterly')) return 'QUARTERLY'
  if (frequency.includes('yearly') || frequency.includes('annually')) return 'YEARLY'
  
  return 'WEEKLY' // Default
}

async function demoAIFrequency() {
  try {
    console.log('Setting up demo AI frequency detection...')
    
    // Get existing schedules
    const schedules = await prisma.schedule.findMany({
      include: {
        tasks: true
      }
    })
    
    console.log(`Found ${schedules.length} schedules to update`)
    
    // Mock some realistic detected frequencies
    const mockDetectedFrequencies = [
      'quarterly deep clean',
      'weekly maintenance', 
      'monthly inspection',
      'bi-weekly cleaning',
      'daily housekeeping'
    ]
    
    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i]
      const mockDetected = mockDetectedFrequencies[i % mockDetectedFrequencies.length]
      
      // Use our mapping function to get suggested frequency
      const suggestedFrequency = mapFrequencyToEnum(mockDetected)
      
      console.log(`Updating "${schedule.title}"`)
      console.log(`  Detected: "${mockDetected}"`)
      console.log(`  Suggested: ${suggestedFrequency}`)
      
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          detectedFrequency: mockDetected,
          suggestedFrequency: suggestedFrequency
        }
      })
    }
    
    console.log('\n✅ Demo frequencies applied!')
    
    // Show updated schedules
    const updatedSchedules = await prisma.schedule.findMany({
      select: {
        title: true,
        detectedFrequency: true,
        suggestedFrequency: true
      }
    })
    
    console.log('\n📋 Updated Schedules:')
    updatedSchedules.forEach((schedule, index) => {
      console.log(`${index + 1}. ${schedule.title}`)
      console.log(`   🤖 AI Detected: "${schedule.detectedFrequency}"`)
      console.log(`   ⚡ Auto-suggests: ${schedule.suggestedFrequency}`)
      console.log('')
    })
    
    console.log('🎉 Now when you assign these schedules to rooms, the frequency will be automatically selected!')
    console.log('💡 You can still manually override the frequency if needed.')
    
  } catch (error) {
    console.error('❌ Error setting up demo:', error)
  } finally {
    await prisma.$disconnect()
  }
}

demoAIFrequency() 