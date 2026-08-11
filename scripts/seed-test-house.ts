/**
 * Seeds a small "Test House" site for hands-on testing, as an alternative to the
 * full care-home dataset (6 sites / 371 rooms) which is too big to click through.
 *
 * Purely additive and re-runnable: every write is an upsert keyed on a natural
 * unique, so running it twice changes nothing and it never touches the existing
 * sites, rooms or completion logs.
 *
 *   npx tsx scripts/seed-test-house.ts
 */
import { hash } from 'bcryptjs'
import { RoomType, ScheduleFrequency, ScheduleStatus } from '../src/generated/prisma/enums'
import { prisma } from '../src/lib/db'

const SITE_NAME = 'Test House'

// Relative to now, so the site always has one of each state to look at.
const daysFromNow = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000)

type RoomSpec = {
  name: string
  floor: string
  type: RoomType
  // Several schedules on one room exercises the one-schedule-at-a-time lock.
  schedules: { title: string; frequency: ScheduleFrequency; status: ScheduleStatus; dueInDays: number }[]
}

const ROOMS: RoomSpec[] = [
  {
    name: 'Test Bedroom 1', floor: 'Ground Floor', type: RoomType.BEDROOM,
    schedules: [
      { title: 'Bedroom Daily Clean', frequency: ScheduleFrequency.DAILY, status: ScheduleStatus.OVERDUE, dueInDays: -2 },
      { title: 'Bedroom Weekly Deep Clean', frequency: ScheduleFrequency.WEEKLY, status: ScheduleStatus.PENDING, dueInDays: 0 },
    ],
  },
  {
    name: 'Test Bedroom 2', floor: 'Ground Floor', type: RoomType.BEDROOM,
    schedules: [
      { title: 'Bedroom Daily Clean', frequency: ScheduleFrequency.DAILY, status: ScheduleStatus.PENDING, dueInDays: 0 },
    ],
  },
  {
    name: 'Test Lounge', floor: 'Ground Floor', type: RoomType.LOUNGE,
    schedules: [
      { title: 'Lounge and Communal Areas', frequency: ScheduleFrequency.DAILY, status: ScheduleStatus.PENDING, dueInDays: 1 },
    ],
  },
  {
    name: 'Test Kitchen', floor: 'Ground Floor', type: RoomType.KITCHEN,
    schedules: [
      { title: 'Kitchen Daily Food Hygiene', frequency: ScheduleFrequency.DAILY, status: ScheduleStatus.OVERDUE, dueInDays: -1 },
      { title: 'Kitchen Deep Clean', frequency: ScheduleFrequency.WEEKLY, status: ScheduleStatus.PENDING, dueInDays: 3 },
    ],
  },
  {
    name: 'Test Bathroom', floor: 'First Floor', type: RoomType.BATHROOM,
    schedules: [
      { title: 'Assisted Bathroom Sanitisation', frequency: ScheduleFrequency.DAILY, status: ScheduleStatus.PENDING, dueInDays: 0 },
    ],
  },
]

const EQUIPMENT: { name: string; type: string; schedules: { title: string; frequency: ScheduleFrequency; status: ScheduleStatus; dueInDays: number }[] }[] = [
  {
    name: 'Test Mobile Hoist', type: 'PATIENT_LIFT',
    schedules: [
      { title: 'Hoist and Sling Safety Check', frequency: ScheduleFrequency.WEEKLY, status: ScheduleStatus.OVERDUE, dueInDays: -3 },
      { title: 'Mobility Equipment Deep Clean', frequency: ScheduleFrequency.MONTHLY, status: ScheduleStatus.PENDING, dueInDays: 5 },
    ],
  },
  {
    name: 'Test Cleaning Trolley', type: 'CLEANING_TROLLEY',
    schedules: [
      { title: 'Cleaning Equipment Service', frequency: ScheduleFrequency.WEEKLY, status: ScheduleStatus.PENDING, dueInDays: 0 },
    ],
  },
]

async function main() {
  const site = await prisma.site.upsert({
    where: { name: SITE_NAME },
    update: {},
    create: { name: SITE_NAME },
  })
  console.log(`site: ${site.name} (${site.id})`)

  // The schedule templates already exist from the main seed; reuse them rather than
  // creating near-duplicates that would clutter the schedule list.
  const titles = [...new Set([...ROOMS.flatMap(r => r.schedules), ...EQUIPMENT.flatMap(e => e.schedules)].map(s => s.title))]
  const templates = await prisma.schedule.findMany({ where: { title: { in: titles } } })
  const byTitle = new Map(templates.map(t => [t.title, t]))

  const missing = titles.filter(t => !byTitle.has(t))
  if (missing.length) {
    throw new Error(`Missing schedule templates: ${missing.join(', ')}. Run prisma/seed.ts first.`)
  }

  // Make the templates available to this site so they can be assigned here.
  await prisma.site.update({
    where: { id: site.id },
    data: { schedules: { connect: templates.map(t => ({ id: t.id })) } },
  })

  for (const spec of ROOMS) {
    const room = await prisma.room.upsert({
      where: { siteId_name: { siteId: site.id, name: spec.name } },
      update: { floor: spec.floor, type: spec.type },
      create: { name: spec.name, floor: spec.floor, type: spec.type, siteId: site.id },
    })
    for (const s of spec.schedules) {
      const tpl = byTitle.get(s.title)!
      await prisma.roomSchedule.upsert({
        where: { roomId_scheduleId: { roomId: room.id, scheduleId: tpl.id } },
        update: { frequency: s.frequency, status: s.status, nextDue: daysFromNow(s.dueInDays) },
        create: {
          roomId: room.id, scheduleId: tpl.id,
          frequency: s.frequency, status: s.status, nextDue: daysFromNow(s.dueInDays),
        },
      })
    }
    console.log(`  room: ${room.name} (${spec.schedules.length} schedules)`)
  }

  for (const spec of EQUIPMENT) {
    const equip = await prisma.equipment.upsert({
      where: { siteId_name: { siteId: site.id, name: spec.name } },
      update: { type: spec.type },
      create: { name: spec.name, type: spec.type, siteId: site.id, description: `${spec.name} for testing.` },
    })
    for (const s of spec.schedules) {
      const tpl = byTitle.get(s.title)!
      await prisma.equipmentSchedule.upsert({
        where: { equipmentId_scheduleId: { equipmentId: equip.id, scheduleId: tpl.id } },
        update: { frequency: s.frequency, status: s.status, nextDue: daysFromNow(s.dueInDays) },
        create: {
          equipmentId: equip.id, scheduleId: tpl.id,
          frequency: s.frequency, status: s.status, nextDue: daysFromNow(s.dueInDays),
        },
      })
    }
    console.log(`  equipment: ${equip.name} (${spec.schedules.length} schedules)`)
  }

  // A cleaner and a manager pinned to this site only. Separate accounts so the
  // existing Risby Park logins keep working exactly as they do now.
  const cleanerPw = await hash('test1234', 12)
  const cleaner = await prisma.user.upsert({
    where: { email: 'test@neatplan.com' },
    update: { siteId: site.id, role: 'CLEANER', isBlocked: false, password: cleanerPw },
    create: {
      email: 'test@neatplan.com', name: 'Test Cleaner', password: cleanerPw,
      role: 'CLEANER', siteId: site.id, isAdmin: false,
    },
  })
  const managerPw = await hash('testmgr123', 12)
  const manager = await prisma.user.upsert({
    where: { email: 'testmanager@neatplan.com' },
    update: { siteId: site.id, role: 'MANAGER', isBlocked: false, password: managerPw },
    create: {
      email: 'testmanager@neatplan.com', name: 'Test Manager', password: managerPw,
      role: 'MANAGER', siteId: site.id, isAdmin: true,
    },
  })
  console.log(`  users: ${cleaner.email} (CLEANER), ${manager.email} (MANAGER)`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async e => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
