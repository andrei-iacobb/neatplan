/**
 * Demo operational data for the six Partnership in Care homes: cleaning schedules,
 * equipment, their assignments, and a fortnight of completion history.
 *
 * Everything here is invented. It is shaped like a real care-home cleaning regime -
 * bedrooms daily, sluices and treatment rooms on infection-control frequencies,
 * kitchens on food-hygiene ones, hoists on LOLER-style inspection intervals - but no
 * figure in it comes from the operator.
 *
 * Idempotent: clears the operational tables it owns first, and never touches users.
 *
 * Run: npx tsx scripts/seed-demo-operations.ts
 */
import { RoomType, ScheduleFrequency, ScheduleStatus } from '../src/generated/prisma/enums'
import type { Prisma } from '../src/generated/prisma/client'
import { prisma } from '../src/lib/db'

/** Deterministic PRNG so reruns produce the same history. */
let seedState = 20260729
const rand = () => {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff
  return seedState / 0x7fffffff
}
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]

const DAY = 24 * 60 * 60 * 1000
const FREQ_DAYS: Record<ScheduleFrequency, number> = {
  DAILY: 1, WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30, QUARTERLY: 91, SEMIANNUAL: 182, YEARLY: 365,
}

interface ScheduleSpec {
  title: string
  frequency: ScheduleFrequency
  /** Room types this applies to. Empty means equipment-only. */
  roomTypes?: RoomType[]
  /** Match communal rooms by name fragment instead of type. */
  nameMatch?: RegExp
  /** Only put this in nursing homes. */
  nursingOnly?: boolean
  tasks: string[]
}

const ROOM_SCHEDULES: ScheduleSpec[] = [
  {
    title: 'Bedroom Daily Clean',
    frequency: ScheduleFrequency.DAILY,
    roomTypes: [RoomType.BEDROOM],
    tasks: [
      'Strip and remake bed, change linen if soiled',
      'Damp dust all surfaces, including over-bed table',
      'Clean and disinfect en-suite, toilet and basin',
      'Empty waste and replace liner',
      'Vacuum or mop floor',
      'Check call bell is within reach and working',
    ],
  },
  {
    title: 'Bedroom Weekly Deep Clean',
    frequency: ScheduleFrequency.WEEKLY,
    roomTypes: [RoomType.BEDROOM],
    tasks: [
      'High dusting - light fittings, curtain rails, tops of wardrobes',
      'Turn and vacuum mattress',
      'Launder curtains if visibly soiled',
      'Descale shower head and taps',
      'Clean inside of windows',
      'Move and clean behind furniture',
    ],
  },
  {
    title: 'Lounge and Communal Areas',
    frequency: ScheduleFrequency.DAILY,
    roomTypes: [RoomType.LOUNGE, RoomType.LOBBY],
    tasks: [
      'Wipe down chair arms and high-touch points',
      'Clean occasional tables',
      'Vacuum carpets and spot-clean spills',
      'Empty bins',
      'Check and clean handrails',
    ],
  },
  {
    title: 'Dining Room Service Clean',
    frequency: ScheduleFrequency.DAILY,
    roomTypes: [],
    nameMatch: /Dining Room/i,
    tasks: [
      'Sanitise all tables between sittings',
      'Wipe chair backs and seats',
      'Sweep and mop floor after each service',
      'Clean condiment station',
    ],
  },
  {
    title: 'Kitchen Daily Food Hygiene',
    frequency: ScheduleFrequency.DAILY,
    roomTypes: [RoomType.KITCHEN],
    tasks: [
      'Sanitise all food preparation surfaces',
      'Record fridge and freezer temperatures',
      'Clean and sanitise sinks and taps',
      'Degrease hob and splashback',
      'Mop floor with food-safe detergent',
      'Remove waste to external bin store',
    ],
  },
  {
    title: 'Kitchen Deep Clean',
    frequency: ScheduleFrequency.MONTHLY,
    roomTypes: [RoomType.KITCHEN],
    tasks: [
      'Clean extraction canopy and change filters',
      'Empty, defrost and sanitise all refrigeration',
      'Descale dishwasher and run cleaning cycle',
      'Clean behind and beneath all equipment',
      'Deep clean floor drains and gullies',
    ],
  },
  {
    title: 'Assisted Bathroom Sanitisation',
    frequency: ScheduleFrequency.DAILY,
    roomTypes: [RoomType.BATHROOM],
    tasks: [
      'Disinfect bath or shower chair and hoist points',
      'Clean and disinfect toilet, including underside of seat',
      'Sanitise grab rails and door handles',
      'Restock soap, towels and gloves',
      'Mop floor with disinfectant',
    ],
  },
  {
    title: 'Sluice Infection Control',
    frequency: ScheduleFrequency.DAILY,
    roomTypes: [],
    nameMatch: /Sluice/i,
    nursingOnly: true,
    tasks: [
      'Run bedpan washer cleaning cycle and record result',
      'Disinfect all work surfaces and sinks',
      'Check and record disinfectant dilution',
      'Dispose of clinical waste to correct stream',
      'Mop floor with chlorine-based disinfectant',
    ],
  },
  {
    title: 'Treatment Room Clinical Clean',
    frequency: ScheduleFrequency.DAILY,
    roomTypes: [],
    nameMatch: /Treatment Room/i,
    nursingOnly: true,
    tasks: [
      'Disinfect couch and clinical surfaces',
      'Clean medication trolley exterior',
      'Check sharps bin fill level and replace if over three quarters',
      'Restock dressings and PPE',
      'Damp mop floor with disinfectant',
    ],
  },
  {
    title: 'Laundry and Store Rooms',
    frequency: ScheduleFrequency.WEEKLY,
    roomTypes: [RoomType.STORAGE],
    tasks: [
      'Clean lint filters on all dryers',
      'Sanitise sorting surfaces',
      'Check COSHH store is locked and stock is in date',
      'Sweep and mop floor',
    ],
  },
  {
    title: 'Office and Staff Areas',
    frequency: ScheduleFrequency.WEEKLY,
    roomTypes: [RoomType.OFFICE],
    tasks: [
      'Dust desks and shelving',
      'Sanitise keyboards, phones and door handles',
      'Empty bins and shred confidential waste',
      'Vacuum floor',
    ],
  },
]

/** Equipment created per home, with the schedules that apply to it. */
const EQUIPMENT: { name: string; type: string; nursingOnly?: boolean; perHome: number }[] = [
  { name: 'Mobile Hoist', type: 'RESIDENT_AID', perHome: 3 },
  { name: 'Standing Aid', type: 'RESIDENT_AID', perHome: 2 },
  { name: 'Shower Chair', type: 'RESIDENT_AID', perHome: 2 },
  { name: 'Profiling Bed', type: 'RESIDENT_AID', perHome: 2 },
  { name: 'Wheelchair', type: 'RESIDENT_AID', perHome: 4 },
  { name: 'Cleaning Trolley', type: 'CLEANING_EQUIPMENT', perHome: 2 },
  { name: 'Upright Vacuum', type: 'CLEANING_EQUIPMENT', perHome: 2 },
  { name: 'Floor Polisher', type: 'CLEANING_EQUIPMENT', perHome: 1 },
  { name: 'Steam Cleaner', type: 'CLEANING_EQUIPMENT', perHome: 1 },
  { name: 'Bedpan Washer', type: 'OTHER', nursingOnly: true, perHome: 1 },
]

const EQUIPMENT_SCHEDULES: { title: string; frequency: ScheduleFrequency; applies: RegExp; tasks: string[] }[] = [
  {
    title: 'Hoist and Sling Safety Check',
    frequency: ScheduleFrequency.MONTHLY,
    applies: /Hoist|Standing Aid/,
    tasks: [
      'Inspect sling webbing and stitching for wear',
      'Test emergency lowering mechanism',
      'Check battery charge and connections',
      'Confirm LOLER inspection is in date',
      'Wipe down and disinfect all contact surfaces',
    ],
  },
  {
    title: 'Mobility Equipment Deep Clean',
    frequency: ScheduleFrequency.WEEKLY,
    applies: /Shower Chair|Wheelchair|Profiling Bed/,
    tasks: [
      'Disinfect all contact surfaces',
      'Clean wheels and castors, remove hair and debris',
      'Check brakes and moving parts',
      'Report any damage to maintenance',
    ],
  },
  {
    title: 'Cleaning Equipment Service',
    frequency: ScheduleFrequency.MONTHLY,
    applies: /Vacuum|Polisher|Steam Cleaner|Trolley/,
    tasks: [
      'Empty and wash dust container',
      'Wash or replace filters',
      'Check cable and plug for damage (PAT in date)',
      'Clean brush head and remove tangled fibre',
    ],
  },
  {
    title: 'Bedpan Washer Validation',
    frequency: ScheduleFrequency.WEEKLY,
    applies: /Bedpan Washer/,
    tasks: [
      'Run thermal disinfection cycle and record temperature',
      'Check and clean spray arms',
      'Verify detergent dosing',
      'Record result in infection control log',
    ],
  },
]

const SIGNATURE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

async function main() {
  const sites = await prisma.site.findMany({ orderBy: { name: 'asc' } })
  if (sites.length === 0) {
    console.error('No sites. Run scripts/seed-partnership-in-care.ts first.')
    process.exit(1)
  }

  console.log('Clearing existing operational data (users untouched)...')
  await prisma.roomScheduleCompletionLog.deleteMany()
  await prisma.equipmentScheduleCompletionLog.deleteMany()
  await prisma.roomCheckIn.deleteMany()
  await prisma.roomSchedule.deleteMany()
  await prisma.equipmentSchedule.deleteMany()
  await prisma.scheduleTask.deleteMany()
  await prisma.schedule.deleteMany()
  await prisma.equipment.deleteMany()

  const nursingHomes = new Set(['Hazell Court', 'Risby Hall', 'Risby Park'])
  const cleaners = await prisma.user.findMany({ where: { role: 'CLEANER' }, select: { id: true, name: true } })
  const now = new Date()

  // ---- Schedules (shared across the sites they apply to) ----
  const roomScheduleIds = new Map<string, string>()
  for (const spec of ROOM_SCHEDULES) {
    const applicableSites = sites.filter((s) => !spec.nursingOnly || nursingHomes.has(s.name))
    const created = await prisma.schedule.create({
      data: {
        title: spec.title,
        suggestedFrequency: spec.frequency,
        detectedFrequency: spec.frequency.toLowerCase(),
        sites: { connect: applicableSites.map((s) => ({ id: s.id })) },
        tasks: { create: spec.tasks.map((description) => ({ description })) },
      },
    })
    roomScheduleIds.set(spec.title, created.id)
  }

  const equipScheduleIds = new Map<string, string>()
  for (const spec of EQUIPMENT_SCHEDULES) {
    const created = await prisma.schedule.create({
      data: {
        title: spec.title,
        suggestedFrequency: spec.frequency,
        detectedFrequency: spec.frequency.toLowerCase(),
        sites: { connect: sites.map((s) => ({ id: s.id })) },
        tasks: { create: spec.tasks.map((description) => ({ description })) },
      },
    })
    equipScheduleIds.set(spec.title, created.id)
  }
  console.log(`  ${ROOM_SCHEDULES.length} room schedules, ${EQUIPMENT_SCHEDULES.length} equipment schedules`)

  // ---- Equipment ----
  let equipmentCount = 0
  for (const site of sites) {
    const nursing = nursingHomes.has(site.name)
    const rows: { name: string; type: string; siteId: string; description: string }[] = []
    for (const e of EQUIPMENT) {
      if (e.nursingOnly && !nursing) continue
      for (let i = 1; i <= e.perHome; i++) {
        rows.push({
          name: `${e.name} ${i}`,
          type: e.type,
          siteId: site.id,
          description: `${e.name} in service at ${site.name}.`,
        })
      }
    }
    await prisma.equipment.createMany({ data: rows })
    equipmentCount += rows.length
  }
  console.log(`  ${equipmentCount} pieces of equipment`)

  // ---- Assign room schedules ----
  const rooms = await prisma.room.findMany({ select: { id: true, name: true, type: true, siteId: true } })
  const siteName = new Map(sites.map((s) => [s.id, s.name]))
  const roomAssignments: { roomId: string; scheduleId: string; frequency: ScheduleFrequency; nextDue: Date; status: ScheduleStatus; lastCompleted: Date | null }[] = []

  for (const room of rooms) {
    const home = siteName.get(room.siteId ?? '') ?? ''
    for (const spec of ROOM_SCHEDULES) {
      if (spec.nursingOnly && !nursingHomes.has(home)) continue
      const matches = spec.nameMatch
        ? spec.nameMatch.test(room.name)
        : (spec.roomTypes ?? []).includes(room.type)
      if (!matches) continue

      // Spread nextDue around now so the dashboard shows a believable mix.
      const offsetDays = (rand() * 2 - 1) * FREQ_DAYS[spec.frequency]
      const nextDue = new Date(now.getTime() + offsetDays * DAY)
      const overdue = nextDue < now
      roomAssignments.push({
        roomId: room.id,
        scheduleId: roomScheduleIds.get(spec.title)!,
        frequency: spec.frequency,
        nextDue,
        status: overdue ? ScheduleStatus.OVERDUE : ScheduleStatus.PENDING,
        lastCompleted: overdue ? new Date(nextDue.getTime() - FREQ_DAYS[spec.frequency] * DAY) : null,
      })
    }
  }
  await prisma.roomSchedule.createMany({ data: roomAssignments, skipDuplicates: true })
  console.log(`  ${roomAssignments.length} room schedule assignments`)

  // ---- Assign equipment schedules ----
  const equipment = await prisma.equipment.findMany({ select: { id: true, name: true } })
  const equipAssignments: { equipmentId: string; scheduleId: string; frequency: ScheduleFrequency; nextDue: Date; status: ScheduleStatus }[] = []
  for (const item of equipment) {
    for (const spec of EQUIPMENT_SCHEDULES) {
      if (!spec.applies.test(item.name)) continue
      const offsetDays = (rand() * 2 - 1) * FREQ_DAYS[spec.frequency]
      const nextDue = new Date(now.getTime() + offsetDays * DAY)
      equipAssignments.push({
        equipmentId: item.id,
        scheduleId: equipScheduleIds.get(spec.title)!,
        frequency: spec.frequency,
        nextDue,
        status: nextDue < now ? ScheduleStatus.OVERDUE : ScheduleStatus.PENDING,
      })
    }
  }
  await prisma.equipmentSchedule.createMany({ data: equipAssignments, skipDuplicates: true })
  console.log(`  ${equipAssignments.length} equipment schedule assignments`)

  // ---- A fortnight of completion history, so the charts have something to draw ----
  if (cleaners.length === 0) {
    console.log('  no CLEANER accounts, skipping completion history')
  } else {
    const assigned = await prisma.roomSchedule.findMany({
      select: { id: true, room: { select: { name: true } }, schedule: { select: { title: true, tasks: { select: { id: true } } } } },
      take: 400,
    })
    const logs: Prisma.RoomScheduleCompletionLogCreateManyInput[] = []
    for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
      // Fewer at weekends, the way a real rota thins out.
      const day = new Date(now.getTime() - daysAgo * DAY)
      const weekend = day.getDay() === 0 || day.getDay() === 6
      const count = Math.floor((weekend ? 8 : 22) + rand() * 10)
      for (let i = 0; i < count; i++) {
        const rs = pick(assigned)
        if (!rs) continue
        const who = pick(cleaners)
        const at = new Date(day)
        at.setHours(7 + Math.floor(rand() * 10), Math.floor(rand() * 60), 0, 0)
        logs.push({
          roomScheduleId: rs.id,
          completedAt: at,
          completedByUserId: who.id,
          completedTasks: rs.schedule.tasks.map((t) => ({ taskId: t.id, notes: null })),
          roomName: rs.room?.name ?? null,
          scheduleTitle: rs.schedule?.title ?? null,
          signatureDataUrl: SIGNATURE,
          signedName: who.name ?? 'Cleaner',
          signedAt: at,
          notes: rand() > 0.85 ? pick(['Resident asleep, returned later.', 'Reported dripping tap to maintenance.', 'Deep clean needed on next visit.']) : null,
        })
      }
    }
    await prisma.roomScheduleCompletionLog.createMany({ data: logs })
    console.log(`  ${logs.length} completion logs over the last 14 days`)
  }

  console.log('\nDone.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
