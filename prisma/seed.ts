import { hash } from 'bcryptjs'
import { RoomType, ScheduleFrequency, ScheduleStatus, UserRole } from '../src/generated/prisma/enums'
import { prisma } from '../src/lib/db'

function seedPassword(name: string, localDefault: string): string {
  const configured = process.env[name]?.trim()
  if (configured) return configured

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} is required when seeding in production`)
  }

  return localDefault
}

async function main() {
  // Resolve every credential before touching the database so a production seed
  // cannot partially apply with missing account secrets.
  const [adminPassword, directorPassword, managerPassword, cleanerPassword] = await Promise.all([
    hash(seedPassword('SEED_ADMIN_PASSWORD', 'admin123'), 12),
    hash(seedPassword('SEED_DIRECTOR_PASSWORD', 'director123'), 12),
    hash(seedPassword('SEED_MANAGER_PASSWORD', 'manager123'), 12),
    hash(seedPassword('SEED_CLEANER_PASSWORD', 'cleaner123'), 12),
  ])

  // Create the primary site all seeded rooms/schedules/users belong to.
  const site = await prisma.site.upsert({
    where: { name: 'Maple Care Home' },
    update: {},
    create: {
      name: 'Maple Care Home',
      address: '1 Maple Avenue',
      description: 'Primary care home site',
    },
  })
  console.log('Site:', site)

  // Owner (OP): spans every site, so siteId stays null. isAdmin = management role.
  const admin = await prisma.user.upsert({
    where: { email: 'admin@neatplan.com' },
    update: {
      isAdmin: true,
      role: UserRole.OP,
      siteId: null,
    },
    create: {
      email: 'admin@neatplan.com',
      password: adminPassword,
      name: 'System Administrator',
      isAdmin: true,
      role: UserRole.OP,
    },
  })
  console.log('Owner (OP) user:', admin)

  // Director: management across every site, no site pin.
  const director = await prisma.user.upsert({
    where: { email: 'director@neatplan.com' },
    update: {
      isAdmin: true,
      role: UserRole.DIRECTOR,
      siteId: null,
    },
    create: {
      email: 'director@neatplan.com',
      password: directorPassword,
      name: 'Diana Director',
      isAdmin: true,
      role: UserRole.DIRECTOR,
    },
  })
  console.log('Director user:', director)

  // Manager: management pinned to a single site.
  const manager = await prisma.user.upsert({
    where: { email: 'manager@neatplan.com' },
    update: {
      isAdmin: true,
      role: UserRole.MANAGER,
      siteId: site.id,
    },
    create: {
      email: 'manager@neatplan.com',
      password: managerPassword,
      name: 'Mark Manager',
      isAdmin: true,
      role: UserRole.MANAGER,
      siteId: site.id,
    },
  })
  console.log('Manager user:', manager)

  // Cleaner: /clean only, pinned to a single site.
  const cleaner = await prisma.user.upsert({
    where: { email: 'cleaner@neatplan.com' },
    update: {
      isAdmin: false,
      role: UserRole.CLEANER,
      siteId: site.id,
    },
    create: {
      email: 'cleaner@neatplan.com',
      password: cleanerPassword,
      name: 'Sarah Johnson',
      isAdmin: false,
      role: UserRole.CLEANER,
      siteId: site.id,
    },
  })
  console.log('Cleaner user:', cleaner)

  // Create rooms if they don't exist (scoped to the site via the composite unique).
  const rooms = await Promise.all([
    prisma.room.upsert({
      where: { siteId_name: { siteId: site.id, name: 'Main Office' } },
      update: {},
      create: {
        name: 'Main Office',
        description: 'Primary office space on ground floor',
        floor: 'Ground Floor',
        type: RoomType.OFFICE,
        siteId: site.id,
      },
    }),
    prisma.room.upsert({
      where: { siteId_name: { siteId: site.id, name: 'Conference Room A' } },
      update: {},
      create: {
        name: 'Conference Room A',
        description: 'Large meeting room with projector',
        floor: 'First Floor',
        type: RoomType.MEETING_ROOM,
        siteId: site.id,
      },
    }),
    prisma.room.upsert({
      where: { siteId_name: { siteId: site.id, name: 'Kitchen' } },
      update: {},
      create: {
        name: 'Kitchen',
        description: 'Staff kitchen and break room',
        floor: 'Ground Floor',
        type: RoomType.KITCHEN,
        siteId: site.id,
      },
    }),
  ])
  console.log('Rooms:', rooms)

  // Create 51 bedroom rooms
  const bedroomRooms = []
  for (let i = 1; i <= 51; i++) {
    const roomName = `Room ${i}`
    let floor: string

    // Determine floor based on room number
    if ((i >= 1 && i <= 9) || (i >= 20 && i <= 32)) {
      floor = 'Ground Floor'
    } else {
      floor = 'Upstairs'
    }

    const room = await prisma.room.upsert({
      where: { siteId_name: { siteId: site.id, name: roomName } },
      update: {},
      create: {
        name: roomName,
        description: `Bedroom ${i}`,
        floor: floor,
        type: RoomType.BEDROOM,
        siteId: site.id,
      },
    })
    bedroomRooms.push(room)
  }
  console.log(`Created ${bedroomRooms.length} bedroom rooms`)

  // Create the schedule if one with this title isn't already linked to the site.
  // Schedule is now many-to-many with Site (no composite unique), so find-or-create.
  const existingSchedule = await prisma.schedule.findFirst({
    where: { title: 'Standard Cleaning Schedule', sites: { some: { id: site.id } } },
  })
  const schedule = existingSchedule ?? await prisma.schedule.create({
    data: {
      title: 'Standard Cleaning Schedule',
      sites: { connect: { id: site.id } },
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
