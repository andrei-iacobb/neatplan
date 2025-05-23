import { PrismaClient } from '@prisma/client'
import { RoomType } from '../src/types/room'

const prisma = new PrismaClient()

async function updateRooms() {
  try {
    // Update all rooms to BEDROOM type
    const result = await prisma.room.updateMany({
      where: {
        type: RoomType.OTHER
      },
      data: {
        type: RoomType.BEDROOM
      }
    })

    console.log(`Successfully updated ${result.count} rooms to BEDROOM type!`)
  } catch (error) {
    console.error('Error updating rooms:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateRooms() 