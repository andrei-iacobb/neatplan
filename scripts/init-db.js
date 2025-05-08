const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database initialization...')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      role: 'admin'
    }
  })
  console.log('Admin user created:', admin.username)

  // Create cleaner user
  const cleanerPassword = await bcrypt.hash('cleaner123', 10)
  const cleaner = await prisma.user.upsert({
    where: { username: 'cleaner' },
    update: {},
    create: {
      username: 'cleaner',
      password: cleanerPassword,
      role: 'cleaner'
    }
  })
  console.log('Cleaner user created:', cleaner.username)

  // Create sample rooms
  const rooms = await Promise.all([
    prisma.room.upsert({
      where: { name: 'Room 101' },
      update: {},
      create: {
        name: 'Room 101',
        building: 'Main Building',
        floor: '1st Floor',
        status: 'clean'
      }
    }),
    prisma.room.upsert({
      where: { name: 'Room 102' },
      update: {},
      create: {
        name: 'Room 102',
        building: 'Main Building',
        floor: '1st Floor',
        status: 'needs_cleaning'
      }
    }),
    prisma.room.upsert({
      where: { name: 'Room 201' },
      update: {},
      create: {
        name: 'Room 201',
        building: 'Main Building',
        floor: '2nd Floor',
        status: 'in_progress'
      }
    })
  ])
  console.log('Sample rooms created:', rooms.map(r => r.name))

  // Create sample tasks
  const tasks = await Promise.all([
    prisma.task.create({
      data: {
        title: 'Clean bathroom',
        description: 'Thorough cleaning of bathroom facilities',
        priority: 'high',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        roomId: rooms[0].id,
        assignedTo: cleaner.id
      }
    }),
    prisma.task.create({
      data: {
        title: 'Vacuum carpet',
        description: 'Vacuum all carpeted areas',
        priority: 'normal',
        dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000), // Day after tomorrow
        roomId: rooms[1].id
      }
    }),
    prisma.task.create({
      data: {
        title: 'Dust surfaces',
        description: 'Dust all surfaces and furniture',
        priority: 'low',
        dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000), // 3 days from now
        roomId: rooms[2].id,
        assignedTo: cleaner.id
      }
    })
  ])
  console.log('Sample tasks created:', tasks.map(t => t.title))

  console.log('Database initialization completed successfully!')
}

main()
  .catch((e) => {
    console.error('Error initializing database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 