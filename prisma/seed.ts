import { PrismaClient, RoomType, ScheduleFrequency, ScheduleStatus } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create or update admin user
  const adminPassword = await hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@cleantrack.com' },
    update: {
      isAdmin: true,
    },
    create: {
      email: 'admin@cleantrack.com',
      password: adminPassword,
      name: 'Admin User',
      isAdmin: true,
    },
  })
  console.log('Admin user:', admin)

  // Create rooms if they don't exist
  const rooms = await Promise.all([
    prisma.room.upsert({
      where: { name: 'Main Office' },
      update: {},
      create: {
        name: 'Main Office',
        description: 'Primary office space on ground floor',
        floor: 'Ground Floor',
        type: RoomType.OFFICE,
      },
    }),
    prisma.room.upsert({
      where: { name: 'Conference Room A' },
      update: {},
      create: {
        name: 'Conference Room A',
        description: 'Large meeting room with projector',
        floor: 'First Floor',
        type: RoomType.MEETING_ROOM,
      },
    }),
    prisma.room.upsert({
      where: { name: 'Kitchen' },
      update: {},
      create: {
        name: 'Kitchen',
        description: 'Staff kitchen and break room',
        floor: 'Ground Floor',
        type: RoomType.KITCHEN,
      },
    }),
  ])
  console.log('Rooms:', rooms)

  // Create cleaning tasks if they don't exist
  const cleaningTasks = await Promise.all(
    rooms.map(room =>
      prisma.cleaningTask.upsert({
        where: {
          roomId_taskDescription: {
            roomId: room.id,
            taskDescription: `Default cleaning for ${room.name}`,
          },
        },
        update: {},
        create: {
          taskDescription: `Default cleaning for ${room.name}`,
          frequency: 'Daily',
          estimatedDuration: '30 minutes',
          status: 'pending',
          roomId: room.id,
        },
      })
    )
  )
  console.log('Cleaning tasks:', cleaningTasks)

  // Create schedule if it doesn't exist
  const schedule = await prisma.schedule.upsert({
    where: { title: 'Standard Cleaning Schedule' },
    update: {},
    create: {
      title: 'Standard Cleaning Schedule',
      tasks: {
        create: [
          {
            description: 'Regular office cleaning',
            frequency: 'Daily',
            additionalNotes: 'Focus on high-traffic areas',
          },
          {
            description: 'Window cleaning',
            frequency: 'Weekly',
            additionalNotes: 'Use appropriate glass cleaner',
          },
        ],
      },
    },
  })
  console.log('Schedule:', schedule)

  // Assign schedules to rooms if not already assigned
  const roomSchedules = await Promise.all(
    rooms.slice(0, 2).map((room, index) =>
      prisma.roomSchedule.upsert({
        where: {
          roomId_scheduleId: {
            roomId: room.id,
            scheduleId: schedule.id,
          },
        },
        update: {},
        create: {
          roomId: room.id,
          scheduleId: schedule.id,
          frequency: index === 0 ? ScheduleFrequency.DAILY : ScheduleFrequency.WEEKLY,
          nextDue: new Date(Date.now() + (index === 0 ? 24 : 7 * 24) * 60 * 60 * 1000),
          status: ScheduleStatus.PENDING,
        },
      })
    )
  )
  console.log('Room schedules:', roomSchedules)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 