import { prisma } from '../src/lib/db'
import { RoomType } from '@prisma/client'

async function createRooms() {
  const rooms = []

  // Create rooms 1-51
  for (let i = 1; i <= 51; i++) {
    // Determine floor based on room number
    let floor = 'First Floor'
    if ((i >= 1 && i <= 9) || (i >= 20 && i <= 32)) {
      floor = 'Ground Floor'
    }

    rooms.push({
      name: `Room ${i}`,
      type: RoomType.BEDROOM,
      floor: floor,
      description: `Bedroom ${i} on ${floor}`
    })
  }

  // Insert all rooms
  try {
    const result = await prisma.room.createMany({
      data: rooms,
      skipDuplicates: true,
    })
    console.log(`Successfully created ${result.count} rooms`)
  } catch (error) {
    console.error('Error creating rooms:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createRooms() 