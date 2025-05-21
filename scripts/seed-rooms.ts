import { PrismaClient } from '../src/generated/prisma'

const prisma = new PrismaClient()

async function seedRooms() {
  try {
    // Create rooms 1-9 (downstairs)
    for (let i = 1; i <= 9; i++) {
      await prisma.room.create({
        data: {
          name: `Room ${i}`,
          description: `Bedroom ${i}`,
          floor: 'Ground Floor',
          type: 'OTHER'
        }
      })
    }

    // Create rooms 10-19 (first floor)
    for (let i = 10; i <= 19; i++) {
      await prisma.room.create({
        data: {
          name: `Room ${i}`,
          description: `Bedroom ${i}`,
          floor: 'First Floor',
          type: 'OTHER'
        }
      })
    }

    // Create rooms 20-32 (downstairs)
    for (let i = 20; i <= 32; i++) {
      await prisma.room.create({
        data: {
          name: `Room ${i}`,
          description: `Bedroom ${i}`,
          floor: 'Ground Floor',
          type: 'OTHER'
        }
      })
    }

    // Create rooms 33-51 (first floor)
    for (let i = 33; i <= 51; i++) {
      await prisma.room.create({
        data: {
          name: `Room ${i}`,
          description: `Bedroom ${i}`,
          floor: 'First Floor',
          type: 'OTHER'
        }
      })
    }

    console.log('Successfully seeded 51 rooms!')
  } catch (error) {
    console.error('Error seeding rooms:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedRooms() 