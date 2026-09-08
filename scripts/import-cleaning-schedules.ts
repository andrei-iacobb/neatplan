/**
 * Imports the cleaning checklists supplied in August 2026 as reusable schedule
 * templates. The source Word documents are monthly sign-off sheets; dates,
 * initials, signatures and blank location fields are intentionally not imported.
 *
 * Existing room/equipment assignments are preserved. If a matching template is
 * already linked to the target site, its metadata and task list are replaced in
 * one transaction so the script is safe to rerun after correcting a checklist.
 *
 * Run:
 *   pnpm import:cleaning-schedules -- --site "Risby Park"
 *   pnpm import:cleaning-schedules -- --site "Risby Park" --dry-run
 */
import 'dotenv/config'
import { ScheduleFrequency } from '../src/generated/prisma/enums'
import { prisma } from '../src/lib/db'

interface TaskSpec {
  description: string
  frequency?: string
  additionalNotes?: string
}

interface ScheduleSpec {
  title: string
  detectedFrequency: string
  suggestedFrequency: ScheduleFrequency
  tasks: TaskSpec[]
}

const daily = (description: string, additionalNotes?: string): TaskSpec => ({
  description,
  frequency: ScheduleFrequency.DAILY,
  additionalNotes,
})

const deepClean = (description: string, additionalNotes: string): TaskSpec => ({
  description,
  additionalNotes,
})

const CLEANING_SCHEDULES: ScheduleSpec[] = [
  {
    title: 'Resident Bedroom - Daily Cleaning',
    detectedFrequency: 'Daily',
    suggestedFrequency: ScheduleFrequency.DAILY,
    tasks: [
      daily('Clean the overbed table, including underneath and the legs'),
      daily('Wipe the radiator top and front cover; leave dust- and stain-free'),
      daily('Wipe wardrobe doors and handles; remove marks and stains'),
      daily('Wipe the resident armchair and clean beneath the seat cushion'),
      daily('Move the bed and clean behind and beside it'),
      daily('Clean TV screens and mirrors, including the back and base of the TV'),
      daily('High-dust and remove cobwebs, including inside windows and the curtain pole'),
      daily('Clean and descale the ensuite basin and taps'),
      daily('Clean the ensuite toilet and remove scale'),
      {
        description: 'Clean the toilet brush and remove stains or debris; sanitise weekly',
        frequency: 'Daily clean / weekly sanitise',
        additionalNotes: 'The source sheet asks staff to record when the weekly sanitisation is completed.',
      },
      daily('Clean the ensuite cabinet and mirror; leave smear-free'),
      daily('Clean ensuite tiles and visible pipework; leave dust-free'),
      daily('Mop the ensuite floor'),
      daily('Empty the bedroom bin'),
      daily('Clean the bedroom sink and descale taps, where present'),
      daily('Clean the toilet or commode, where present'),
      daily('Vacuum or mop the bedroom floor'),
      daily('Damp-dust furniture and personal ornaments'),
      daily('Refill the soap dispenser and paper towels'),
      daily('Wipe the inside of windows and window ledges'),
      daily('Wipe and disinfect the bed foot and headboard'),
      daily('Wipe the bed remote and cord; leave dust- and stain-free'),
      daily('Clean the cooling fan; leave free of dust and debris'),
      daily('Wipe the commode frame and seat, including legs and fixings'),
      daily('Wipe the inside of the door and the door handle'),
      daily('Clean the call bell and cord; leave free of stains and debris'),
      daily('Clean the room sensor unit and cord; leave dust- and stain-free'),
    ],
  },
  {
    title: 'Office - Daily Cleaning',
    detectedFrequency: 'Daily',
    suggestedFrequency: ScheduleFrequency.DAILY,
    tasks: [
      daily('Empty office bins'),
      daily('Polish furniture and monitors; leave dust- and smear-free'),
      daily('Check and empty the paper shredder'),
      daily('Damp-dust electrical equipment'),
      daily('Clean the fingerprint recorder, where present'),
      daily('Wipe all other surfaces'),
      daily('Check and wipe the radiator'),
      daily('High- and low-dust the office'),
      daily('Vacuum the carpet'),
      daily('Clean the inside of windows and window ledges; leave dust- and smear-free'),
    ],
  },
  {
    title: 'Hairdressers - Wednesday Afternoon Cleaning',
    detectedFrequency: 'Every Wednesday afternoon',
    suggestedFrequency: ScheduleFrequency.WEEKLY,
    tasks: [
      'Empty the bin',
      'High- and low-dust, then mop the skirting boards',
      'Clean and descale sinks and taps',
      'Clean inside windows, window ledges and mirrors',
      'Sweep and mop the floor',
      'Wipe all counter worktops',
      'Wipe all chairs and chair bases',
      'Wipe the hooded hairdryer',
    ].map((description) => ({ description })),
  },
  {
    title: 'Hairdressers - Thursday Afternoon Cleaning',
    detectedFrequency: 'Every Thursday afternoon',
    suggestedFrequency: ScheduleFrequency.WEEKLY,
    tasks: [
      'Empty the bin',
      'High- and low-dust, then mop the skirting boards',
      'Clean and descale sinks and taps',
      'Clean inside windows, window ledges and mirrors',
      'Sweep and mop the floor',
      'Wipe all counter worktops',
      'Wipe all chairs and chair bases',
      'Wipe the hooded hairdryer',
    ].map((description) => ({ description })),
  },
  {
    title: 'Corridors - Daily Cleaning',
    detectedFrequency: 'Daily',
    suggestedFrequency: ScheduleFrequency.DAILY,
    tasks: [
      daily('High- and low-dust the corridor'),
      daily('Clean inside windows and window ledges; remove cobwebs'),
      daily('Wipe handrails and other touch points'),
      daily('Vacuum the carpet'),
      daily('Wipe fire extinguishers'),
      daily('Wipe walls and skirting boards; remove marks and stains'),
      daily('Wipe doors and clean internal glass; leave smear-free'),
      daily('Clean curtains or blinds; leave free of dust and stains'),
      daily('Wipe radiator tops and covers; leave free of dust and stains'),
    ],
  },
  {
    title: 'Garden Room - Daily Cleaning',
    detectedFrequency: 'Daily',
    suggestedFrequency: ScheduleFrequency.DAILY,
    tasks: [
      daily('High- and low-dust and remove cobwebs'),
      daily('Clean inside windows and window ledges'),
      daily('Polish furniture; leave smear-free'),
      daily('Vacuum the carpet'),
      daily('Wipe chairs and cushions; remove debris'),
      daily('Wipe walls and skirting boards; remove marks and stains'),
      daily('Wipe the door, frame and handle'),
      daily('Clean curtains or blinds; leave free of dust and stains'),
      daily('Clean internal glass and windows; leave smear-free'),
    ],
  },
  {
    title: 'Lounges - Daily Cleaning',
    detectedFrequency: 'Daily',
    suggestedFrequency: ScheduleFrequency.DAILY,
    tasks: [
      daily('Empty the bin'),
      daily('Clean inside windows and window ledges; remove cobwebs'),
      daily('Polish all furniture'),
      daily('Vacuum the carpet'),
      daily('Wipe armchairs and beneath cushions; leave clean and odour-free'),
      daily('Wipe walls and skirting boards; remove marks and stains'),
      daily('Wipe doors and clean internal glass; leave smear-free'),
      daily('Clean curtains or blinds; leave free of dust and stains'),
      daily('Disinfect and wipe overbed tables'),
      daily('Clean the TV; leave dust- and smear-free'),
    ],
  },
  {
    title: 'Main Entrance and Foyer - Daily Cleaning',
    detectedFrequency: 'Daily',
    suggestedFrequency: ScheduleFrequency.DAILY,
    tasks: [
      daily('High- and low-dust and remove cobwebs'),
      daily('Clean inside windows and window ledges'),
      daily('Wipe the fire grab bag'),
      daily('Vacuum the carpeted area'),
      daily('Wipe furniture and chairs; leave smear-free'),
      daily('Wipe walls and skirting boards; remove marks and stains'),
      daily('Wipe doors and clean internal glass; leave smear-free'),
      daily('Wipe ledges and shelving'),
      daily('Wipe all touch points'),
      daily('Check and replenish the air freshener'),
    ],
  },
  {
    title: 'Satellite Kitchen - Daily Cleaning',
    detectedFrequency: 'Daily',
    suggestedFrequency: ScheduleFrequency.DAILY,
    tasks: [
      {
        description: 'Empty the bin and clean the lid; sanitise the bin weekly',
        frequency: 'Daily clean / weekly sanitise',
      },
      daily('Clean the sink and drainer, and descale the taps'),
      daily('Wipe shelving, worktops and units'),
      daily('Check and refill dispensers'),
      daily('Check walls, tiles and the window ledge; remove stains'),
      daily('Wipe the door, handle and frame; leave free of dust and stains'),
      daily('Clean and descale the hot-water dispenser or kettle'),
      daily('Clean the microwave inside and out'),
      daily('Sweep and mop the floor, then leave it dry'),
    ],
  },
  {
    title: 'Stairwells - Daily Cleaning',
    detectedFrequency: 'Daily',
    suggestedFrequency: ScheduleFrequency.DAILY,
    tasks: [
      daily('High- and low-dust the stairwell'),
      daily('Clean inside windows and window ledges; remove cobwebs'),
      daily('Wipe handrails and other touch points'),
      daily('Vacuum carpet and wipe stair treads'),
      daily('Wipe fire extinguishers'),
      daily('Wipe walls and skirting boards; remove marks and stains'),
      daily('Wipe doors and clean internal glass; leave smear-free'),
      daily('Clean curtains or blinds; leave free of dust and stains'),
      daily('Wipe the stairlift, where present; leave free of dust and stains'),
    ],
  },
  {
    title: 'Communal Toilet, Shower and Bathroom - Daily Cleaning',
    detectedFrequency: 'Daily',
    suggestedFrequency: ScheduleFrequency.DAILY,
    tasks: [
      daily('Wipe the wash basin'),
      daily('Clean visible pipework, including the U-bend'),
      daily('Descale and wipe taps'),
      daily('Wipe the radiator top and sides'),
      daily('High- and low-dust the room'),
      daily('Clean the mirror; leave smear-free'),
      daily('Wipe tiled areas'),
      daily('Check and replenish the soap dispenser'),
      daily('Check and replenish the toilet tissue dispenser'),
      daily('Check and replenish the hand-towel dispenser'),
      daily('Check and restock cabinets'),
      daily('Restock gloves and aprons'),
      daily('Wipe the window ledge and remove cobwebs'),
      daily('Clean the inside of the window'),
      daily('Clean the toilet bowl and seat'),
      daily('Clean the raised toilet seat, including underneath and the legs'),
      daily('Wipe the toilet flush control'),
      daily('Wipe handrails and support rails'),
      daily('Clean bins inside and out, including the foot pedal'),
      daily('Wipe the door, frame and handle'),
      daily('Mop the floor'),
    ],
  },
  {
    title: 'Sluice Room - Daily Cleaning',
    detectedFrequency: 'Daily',
    suggestedFrequency: ScheduleFrequency.DAILY,
    tasks: [
      daily('Wipe the wash basin'),
      daily('Clean visible pipework, including the U-bend'),
      daily('Descale and wipe taps'),
      daily('Wipe the radiator top and sides'),
      daily('High- and low-dust the room'),
      daily('Wipe tiled areas'),
      daily('Check and replenish the soap dispenser'),
      daily('Check and replenish the hand-towel dispenser'),
      daily('Restock gloves and other consumables'),
      daily('Wipe the window ledge and remove cobwebs'),
      daily('Clean the inside of the window'),
      daily('Clean the sluice sink and cistern'),
      daily('Descale the sluice sink taps'),
      daily('Wipe the commode-pot holder'),
      daily('Check and clean all visible pipework'),
      daily('Clean bins inside and out, including the foot pedal'),
      daily('Wipe the door, frame and handle'),
      daily('Mop the floor'),
    ],
  },
  {
    title: 'Communal Toilet - Deep Clean',
    detectedFrequency: 'Deep clean - recurrence not stated in the source',
    suggestedFrequency: ScheduleFrequency.MONTHLY,
    tasks: [
      deepClean('General waste and yellow bins', 'Empty, clean and sanitise the bins. Leave to air dry; steam-clean if preferred.'),
      deepClean('Windows and window ledges', 'Open windows to aid drying and prevent chemical odour build-up. Wipe the inside of the window and the ledge.'),
      deepClean('Mirrors', 'Clean the mirror and buff with a clean, dry cloth.'),
      deepClean('Toilet bowl', 'Clean and sanitise thoroughly, rinse, then dry with a clean cloth. Apply limescale remover according to local procedure and scrub with the toilet brush until scale is removed.'),
      deepClean('Tiled areas', 'Clean thoroughly, sanitise with the approved chlorine solution, then buff with a clean, dry cloth until smear-free.'),
      deepClean('High- and low-dusting', 'Remove dust and cobwebs from all high and low areas.'),
      deepClean('Walls, skirting boards and radiator', 'Wipe all surfaces and remove marks and stains.'),
      deepClean('Floor', 'Scrub with the electric floor scrubber or hand scrubber, then sanitise with the approved chlorine solution.'),
      deepClean('Dispensers and cabinets', 'Empty, clean thoroughly, dry with a clean cloth, then restock.'),
      deepClean('Door and frame', 'Clean and sanitise with the approved chlorine solution, then dry and remove smears with a clean cloth.'),
      deepClean('Sink and taps', 'Clean the sink and beneath the basin, rinse and dry. Descale taps, rinse and buff until smear-free.'),
    ],
  },
  {
    title: 'Bath and Shower Room - Deep Clean',
    detectedFrequency: 'Deep clean - recurrence not stated in the source',
    suggestedFrequency: ScheduleFrequency.MONTHLY,
    tasks: [
      deepClean('General waste and yellow bins', 'Empty, clean and sanitise the bins. Leave to air dry; steam-clean if preferred.'),
      deepClean('Windows and window ledges', 'Open windows to aid drying and prevent chemical odour build-up. Wipe the inside of the window and the ledge.'),
      deepClean('Shower head, hose and taps', 'Remove and descale the shower head. Descale the hose and all taps, rinse thoroughly, then buff with a clean, dry cloth.'),
      deepClean('Mirrors', 'Clean the mirror and buff with a clean, dry cloth.'),
      deepClean('Bath, shower seat and toilet', 'Clean and sanitise thoroughly, rinse properly, then dry with a clean cloth.'),
      deepClean('Tiled areas', 'Clean thoroughly, sanitise with the approved chlorine solution, then buff with a clean, dry cloth until smear-free.'),
      deepClean('Bath, sink and taps', 'Clean the sink and beneath the basin, rinse and dry. Descale taps to remove limescale.'),
      deepClean('High- and low-dusting', 'Remove dust and cobwebs from all high and low areas.'),
      deepClean('Walls and skirting boards', 'Wipe all surfaces and remove marks and stains.'),
      deepClean('Floor', 'Scrub with the electric floor scrubber or hand scrubber, then sanitise with the approved chlorine solution.'),
      deepClean('Dispensers and cabinets', 'Empty, clean thoroughly, dry with a clean cloth, then restock.'),
      deepClean('Door and frame', 'Clean and sanitise with the approved chlorine solution, then dry and remove smears with a clean cloth.'),
    ],
  },
  {
    title: 'Stairwells - Deep Clean',
    detectedFrequency: 'Deep clean - recurrence not stated in the source',
    suggestedFrequency: ScheduleFrequency.MONTHLY,
    tasks: [
      deepClean('Carpeted areas', 'Vacuum, then clean with the carpet cleaner. Clearly sign and block off the area while wet.'),
      deepClean('Windows and window ledges', 'Open windows to aid drying and prevent chemical odour build-up. Clean inside, then buff with a clean, dry cloth until smear-free.'),
      deepClean('Stair treads', 'Clean the stair treads and dry with a clean cloth.'),
      deepClean('Handrails', 'Wipe, sanitise, then leave to air dry.'),
      deepClean('Internal door glass', 'Clean thoroughly and buff with a clean, dry cloth until smear-free.'),
      deepClean('High- and low-dusting', 'Remove dust and cobwebs from all high and low areas.'),
      deepClean('Walls and skirting boards', 'Wipe all surfaces and remove marks and stains.'),
      deepClean('Curtains and blinds', 'Remove curtains for laundering. Wipe dust and debris from blinds, then clean them according to the manufacturer instructions.'),
      deepClean('Stairlift, where present', 'Ask Maintenance to explain the hazards before cleaning. Wipe the stairlift, including the armrest and seat.'),
      deepClean('Door and frame', 'Clean and sanitise with the approved chlorine solution. Dry, remove smears and leave door glass smear-free.'),
    ],
  },
  {
    title: 'Corridors - Deep Clean',
    detectedFrequency: 'Deep clean - recurrence not stated in the source',
    suggestedFrequency: ScheduleFrequency.MONTHLY,
    tasks: [
      deepClean('Carpeted areas', 'Vacuum, then clean with the carpet cleaner. Clearly sign and block off the area while wet.'),
      deepClean('Windows and window ledges', 'Open windows to aid drying and prevent chemical odour build-up. Clean inside, then buff with a clean, dry cloth until smear-free.'),
      deepClean('Fire extinguishers and holders', 'Remove each extinguisher from its holder, wipe the body, handle and hose, then dry until smear-free. Clean the holder inside and out.'),
      deepClean('Handrails', 'Wipe, sanitise, then leave to air dry.'),
      deepClean('Internal door glass', 'Clean thoroughly and buff with a clean, dry cloth until smear-free.'),
      deepClean('High- and low-dusting', 'Remove dust and cobwebs from all high and low areas.'),
      deepClean('Walls and skirting boards', 'Wipe all surfaces and remove marks and stains.'),
      deepClean('Curtains and blinds', 'Remove curtains for laundering. Wipe dust and debris from blinds, then clean them according to the manufacturer instructions.'),
      deepClean('Radiators', 'Remove dust and debris from the radiator top and cover. Steam-clean vented areas, then dry with a clean cloth.'),
      deepClean('Door and frame', 'Clean and sanitise with the approved chlorine solution, then dry and remove smears with a clean cloth.'),
    ],
  },
  {
    title: 'Lounges - Deep Clean',
    detectedFrequency: 'Deep clean - recurrence not stated in the source',
    suggestedFrequency: ScheduleFrequency.MONTHLY,
    tasks: [
      deepClean('Carpeted areas', 'Vacuum, then clean with the carpet cleaner. Clearly sign and block off the area while wet.'),
      deepClean('Windows and window ledges', 'Open windows to aid drying and prevent chemical odour build-up. Clean inside, then buff with a clean, dry cloth until smear-free.'),
      deepClean('Units, shelving and side tables', 'Remove contents and clean inside, including drawers. Once dry, replace the contents. Sanitise the outside with the approved chlorine solution, leave to air dry, then polish.'),
      deepClean('Armchairs', 'Remove cushions and clean the chair and cushions. Steam-clean seams and confined areas, wipe with the approved chlorine solution, then leave to air dry.'),
      deepClean('Internal door glass', 'Clean thoroughly and buff with a clean, dry cloth until smear-free.'),
      deepClean('High- and low-dusting', 'Remove dust and cobwebs from all high and low areas.'),
      deepClean('Walls and skirting boards', 'Wipe all surfaces and remove marks and stains.'),
      deepClean('Curtains and blinds', 'Remove curtains for laundering. Wipe dust and debris from blinds, then clean them according to the manufacturer instructions.'),
      deepClean('Radiators', 'Remove dust and debris from the radiator top and cover. Steam-clean vented areas, then dry with a clean cloth.'),
      deepClean('Door and frame', 'Clean and sanitise with the approved chlorine solution, then dry and remove smears with a clean cloth.'),
    ],
  },
  {
    title: 'Resident Bedroom - Deep Clean',
    detectedFrequency: 'Deep clean - recurrence not stated in the source',
    suggestedFrequency: ScheduleFrequency.MONTHLY,
    tasks: [
      deepClean('Consumable items', 'Dispose of old flowers, food, drinks, waste and other expired or unwanted consumables.'),
      deepClean('Windows and frames', 'Open windows to aid drying and prevent chemical odour build-up. Clean internal windows and frames; leave smear-free.'),
      deepClean('Reusable equipment', 'Clean and disinfect commodes, wheelchairs, walking frames and other reusable equipment before removing them. Do not return equipment until the deep clean is complete.'),
      deepClean('Curtains and soft furnishings', 'Remove curtains and washable covers for laundering before cleaning starts. If curtains cannot be laundered, steam-clean them after the room deep clean.'),
      deepClean('Linen, towels and other laundry', 'Remove laundry. If soiled, place it in a red water-soluble alginate bag, tie it, then place it in the appropriate laundry bag.'),
      deepClean('Lampshades', 'Remove the shade and, if wipeable, clean and disinfect it. Replace it after high-dusting is complete.'),
      deepClean('Curtain tracks', 'Clean and disinfect the curtain tracks.'),
      deepClean('Pictures and ornaments', 'Clean and disinfect pictures and ornaments; leave smear-free.'),
      deepClean('Light switches, door handles and frames', 'Clean and disinfect all touch points and frames.'),
      deepClean('Armchair', 'Remove cushions and clean debris and stains from the seat, back, arms, sides and seams. Disinfect cushions and allow them to air dry. Wipe chair legs and raised feet.'),
      deepClean('Wood or veneer furniture', 'Clean backs and sides. Remove drawers from runners, clean, polish and buff, then replace contents. Remove food build-up from overbed-table edges and underneath.'),
      deepClean('Bed frame', 'Remove the mattress for access. Raise and position the bed safely, switch off and unplug it, then clean the entire frame including underneath the frame rail. Leave to air dry before reconnecting and replacing the mattress.'),
      deepClean('Radiators', 'Remove the cover where possible. Clean and disinfect the cover and radiator, remove dust and debris from grilles, then replace the cover.'),
      deepClean('Skirting boards and walls', 'Clean and disinfect, removing scuffs and stains.'),
      deepClean('Carpet', 'Vacuum, then shampoo with the carpet-cleaning machine and extract all residue.'),
      deepClean('Washable flooring', 'Clean and disinfect, displaying wet-floor safety signs.'),
      deepClean('Ensuite', 'Clean and disinfect all surfaces and fittings, working from the cleanest area to the dirtiest. Remove limescale from taps.'),
      deepClean('Restock consumables', 'Restock paper towels, soap and other room consumables.'),
      deepClean('Make the bed', 'Make the bed with clean linen.'),
      deepClean('Rehang curtains', 'Hang clean curtains and complete the appropriate laundry paperwork.'),
    ],
  },
]

function readSiteName(args: string[]): string {
  const siteFlag = args.indexOf('--site')
  const fromFlag = siteFlag >= 0 ? args[siteFlag + 1]?.trim() : undefined
  const siteName = fromFlag || process.env.SCHEDULE_IMPORT_SITE?.trim() || 'Risby Park'

  if (!siteName || (siteFlag >= 0 && !fromFlag)) {
    throw new Error('Pass a non-empty site name after --site.')
  }

  return siteName
}

function validateSpecs(): void {
  const titles = new Set<string>()
  for (const spec of CLEANING_SCHEDULES) {
    if (titles.has(spec.title)) throw new Error(`Duplicate schedule title: ${spec.title}`)
    titles.add(spec.title)
    if (spec.tasks.length === 0) throw new Error(`Schedule has no tasks: ${spec.title}`)

    const descriptions = new Set<string>()
    for (const task of spec.tasks) {
      if (!task.description.trim()) throw new Error(`Blank task in schedule: ${spec.title}`)
      if (descriptions.has(task.description)) {
        throw new Error(`Duplicate task in ${spec.title}: ${task.description}`)
      }
      descriptions.add(task.description)
    }
  }
}

async function importSchedules(siteName: string): Promise<{ created: number; updated: number; taskCount: number }> {
  return prisma.$transaction(async (tx) => {
    const site = await tx.site.findUnique({ where: { name: siteName }, select: { id: true } })
    if (!site) throw new Error(`Site not found: ${siteName}`)

    let created = 0
    let updated = 0
    let taskCount = 0

    for (const spec of CLEANING_SCHEDULES) {
      const existing = await tx.schedule.findMany({
        where: { title: spec.title, sites: { some: { id: site.id } } },
        select: { id: true },
        take: 2,
      })

      if (existing.length > 1) {
        throw new Error(`More than one "${spec.title}" schedule is linked to ${siteName}; resolve duplicates before importing.`)
      }

      const taskData = spec.tasks.map((task) => ({
        description: task.description,
        frequency: task.frequency ?? null,
        additionalNotes: task.additionalNotes ?? null,
      }))

      if (existing[0]) {
        await tx.schedule.update({
          where: { id: existing[0].id },
          data: {
            detectedFrequency: spec.detectedFrequency,
            suggestedFrequency: spec.suggestedFrequency,
            tasks: {
              deleteMany: {},
              create: taskData,
            },
          },
        })
        updated += 1
      } else {
        await tx.schedule.create({
          data: {
            title: spec.title,
            detectedFrequency: spec.detectedFrequency,
            suggestedFrequency: spec.suggestedFrequency,
            sites: { connect: { id: site.id } },
            tasks: { create: taskData },
          },
        })
        created += 1
      }

      taskCount += taskData.length
    }

    return { created, updated, taskCount }
  })
}

async function main() {
  validateSpecs()
  const siteName = readSiteName(process.argv.slice(2))
  const taskCount = CLEANING_SCHEDULES.reduce((total, schedule) => total + schedule.tasks.length, 0)

  if (process.argv.includes('--dry-run')) {
    console.log(`Validated ${CLEANING_SCHEDULES.length} schedules with ${taskCount} tasks for ${siteName}. No database changes made.`)
    return
  }

  const result = await importSchedules(siteName)
  console.log(
    `Imported ${CLEANING_SCHEDULES.length} schedules with ${result.taskCount} tasks into ${siteName}: ` +
      `${result.created} created, ${result.updated} updated.`,
  )
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
