import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addSampleEquipment() {
  try {
    console.log('Adding sample equipment...')

    // Create sample equipment
    const vacuumCleaner = await prisma.equipment.create({
      data: {
        name: 'Main Floor Vacuum Cleaner',
        description: 'Commercial grade vacuum cleaner for daily cleaning',
        location: 'Storage Room A',
        type: 'VACUUM_CLEANER',
        model: 'Shark Navigator Pro',
        serialNumber: 'SN-2024-001',
        purchaseDate: new Date('2024-01-15'),
        warrantyExpiry: new Date('2026-01-15')
      }
    })

    const floorScrubber = await prisma.equipment.create({
      data: {
        name: 'Industrial Floor Scrubber',
        description: 'Heavy duty floor scrubber for deep cleaning',
        location: 'Maintenance Area',
        type: 'FLOOR_SCRUBBER',
        model: 'TennantTrue T3',
        serialNumber: 'FS-2024-002',
        purchaseDate: new Date('2024-02-01'),
        warrantyExpiry: new Date('2027-02-01')
      }
    })

    const coffeeMachine = await prisma.equipment.create({
      data: {
        name: 'Office Coffee Machine',
        description: 'Main break room coffee machine',
        location: 'Break Room',
        type: 'COFFEE_MACHINE',
        model: 'Keurig K-Elite',
        serialNumber: 'CM-2024-003',
        purchaseDate: new Date('2024-03-10')
      }
    })

    // Get existing schedules
    const dailyCleanSchedule = await prisma.schedule.findFirst({
      where: { title: { contains: 'Daily' } }
    })

    const weeklyMaintenanceSchedule = await prisma.schedule.findFirst({
      where: { title: { contains: 'Weekly' } }
    })

    // If no schedules exist, create them
    let dailySchedule = dailyCleanSchedule
    if (!dailySchedule) {
      dailySchedule = await prisma.schedule.create({
        data: {
          title: 'Daily Equipment Maintenance',
          detectedFrequency: 'daily',
          suggestedFrequency: 'DAILY',
          tasks: {
            create: [
              {
                description: 'Check equipment functionality',
                frequency: 'daily',
                additionalNotes: 'Ensure all equipment is working properly'
              },
              {
                description: 'Clean and sanitize',
                frequency: 'daily',
                additionalNotes: 'Wipe down surfaces and empty bins'
              }
            ]
          }
        }
      })
    }

    let weeklySchedule = weeklyMaintenanceSchedule
    if (!weeklySchedule) {
      weeklySchedule = await prisma.schedule.create({
        data: {
          title: 'Weekly Deep Maintenance',
          detectedFrequency: 'weekly',
          suggestedFrequency: 'WEEKLY',
          tasks: {
            create: [
              {
                description: 'Deep clean and inspection',
                frequency: 'weekly',
                additionalNotes: 'Thorough cleaning and maintenance check'
              },
              {
                description: 'Replace filters and consumables',
                frequency: 'weekly',
                additionalNotes: 'Check and replace as needed'
              },
              {
                description: 'Performance testing',
                frequency: 'weekly',
                additionalNotes: 'Test all functions and document issues'
              }
            ]
          }
        }
      })
    }

    // Add equipment schedules
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const nextWeek = new Date(now)
    nextWeek.setDate(nextWeek.getDate() + 7)

    // Vacuum cleaner - daily maintenance
    await prisma.equipmentSchedule.create({
      data: {
        equipmentId: vacuumCleaner.id,
        scheduleId: dailySchedule.id,
        frequency: 'DAILY',
        startDate: now,
        nextDue: tomorrow,
        status: 'PENDING'
      }
    })

    // Floor scrubber - weekly deep maintenance  
    await prisma.equipmentSchedule.create({
      data: {
        equipmentId: floorScrubber.id,
        scheduleId: weeklySchedule.id,
        frequency: 'WEEKLY',
        startDate: now,
        nextDue: nextWeek,
        status: 'PENDING'
      }
    })

    // Coffee machine - daily cleaning
    await prisma.equipmentSchedule.create({
      data: {
        equipmentId: coffeeMachine.id,
        scheduleId: dailySchedule.id,
        frequency: 'DAILY',
        startDate: now,
        nextDue: tomorrow,
        status: 'PENDING'
      }
    })

    console.log('✅ Sample equipment added successfully:')
    console.log(`- ${vacuumCleaner.name}`)
    console.log(`- ${floorScrubber.name}`)
    console.log(`- ${coffeeMachine.name}`)
    console.log('\n✅ Equipment schedules created successfully')

  } catch (error) {
    console.error('Error adding sample equipment:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addSampleEquipment() 