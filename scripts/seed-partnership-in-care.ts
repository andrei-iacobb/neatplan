/**
 * Seeds the six homes operated by The Partnership in Care (Suffolk), a family-run
 * group of ~30 years standing supporting over 300 people.
 *
 * Home names, towns, resident counts and specialisms are taken from the operator's
 * own "Our Homes" page (thepartnershipincare.co.uk/our-homes).
 *
 * BEDROOM NUMBERING IS DERIVED, NOT REAL. The published figure is a resident count,
 * so each home gets that many bedrooms numbered sequentially and split across floors.
 * Their ECS backups carry residents and care notes, not a room inventory, so there is
 * no authoritative room list to import. Communal rooms are the standard set a home of
 * this type runs, with a treatment room and sluice only where nursing is registered.
 *
 * Run: npx tsx scripts/seed-partnership-in-care.ts
 */
import { PrismaClient, RoomType } from '@prisma/client'

const prisma = new PrismaClient()

interface Home {
  name: string
  town: string
  residents: number
  nursing: boolean
  /** Extra communal rooms beyond the standard set. */
  extra?: { name: string; type: RoomType; floor: string }[]
  description: string
}

const HOMES: Home[] = [
  {
    name: 'Beech House',
    town: 'Halesworth',
    residents: 49,
    nursing: false,
    description: 'Residential care with dementia specialism, Halesworth.',
  },
  {
    name: 'Sherrington House',
    town: 'Ipswich',
    residents: 47,
    nursing: false,
    description: 'Residential care with dementia specialism, Ipswich.',
  },
  {
    name: 'Prince of Wales House',
    town: 'Ipswich',
    residents: 49,
    nursing: false,
    description: 'Residential care with dementia specialism, Ipswich.',
  },
  {
    name: 'Hazell Court',
    town: 'Sudbury',
    residents: 55,
    nursing: true,
    description:
      'Residential and nursing care with dementia specialism, Sudbury. Includes an 18-bed rehabilitation unit.',
    extra: [
      { name: 'Rehabilitation Unit - Therapy Room', type: RoomType.OTHER, floor: 'Ground Floor' },
      { name: 'Rehabilitation Unit - Gym', type: RoomType.OTHER, floor: 'Ground Floor' },
    ],
  },
  {
    name: 'Risby Hall',
    town: 'Risby',
    residents: 34,
    nursing: true,
    description: 'Nursing care with dementia specialism, Risby. Twenty-four hour nursing support.',
  },
  {
    name: 'Risby Park',
    town: 'Risby',
    residents: 54,
    nursing: true,
    description: 'Nursing care with dementia specialism, Risby. Twenty-four hour nursing support.',
  },
]

/** The communal spaces every home of this type runs. */
function communalRooms(home: Home) {
  const rooms: { name: string; type: RoomType; floor: string; description: string }[] = [
    { name: 'Reception', type: RoomType.LOBBY, floor: 'Ground Floor', description: 'Main entrance and visitor sign-in.' },
    { name: 'Main Lounge', type: RoomType.LOUNGE, floor: 'Ground Floor', description: 'Primary communal lounge.' },
    { name: 'Quiet Lounge', type: RoomType.LOUNGE, floor: 'First Floor', description: 'Secondary seating area.' },
    { name: 'Dining Room', type: RoomType.OTHER, floor: 'Ground Floor', description: 'Main dining room.' },
    { name: 'Kitchen', type: RoomType.KITCHEN, floor: 'Ground Floor', description: 'Main catering kitchen.' },
    { name: 'Laundry', type: RoomType.STORAGE, floor: 'Ground Floor', description: 'Laundry and linen store.' },
    { name: 'Staff Office', type: RoomType.OFFICE, floor: 'Ground Floor', description: 'Home management office.' },
    { name: 'Staff Room', type: RoomType.OTHER, floor: 'Ground Floor', description: 'Staff break room.' },
    { name: 'Assisted Bathroom - Ground', type: RoomType.BATHROOM, floor: 'Ground Floor', description: 'Assisted bathing facility.' },
    { name: 'Assisted Bathroom - First', type: RoomType.BATHROOM, floor: 'First Floor', description: 'Assisted bathing facility.' },
    { name: 'Visitor WC', type: RoomType.BATHROOM, floor: 'Ground Floor', description: 'Visitor toilet.' },
    { name: 'Cleaning Store', type: RoomType.STORAGE, floor: 'Ground Floor', description: 'COSHH cleaning store.' },
  ]

  if (home.nursing) {
    rooms.push(
      { name: 'Treatment Room', type: RoomType.OTHER, floor: 'Ground Floor', description: 'Clinical treatment and medication room.' },
      { name: 'Sluice - Ground', type: RoomType.OTHER, floor: 'Ground Floor', description: 'Sluice and infection control.' },
      { name: 'Sluice - First', type: RoomType.OTHER, floor: 'First Floor', description: 'Sluice and infection control.' },
    )
  }

  for (const e of home.extra ?? []) {
    rooms.push({ ...e, description: 'Rehabilitation unit facility.' })
  }

  return rooms
}

async function main() {
  let totalRooms = 0

  for (const home of HOMES) {
    const site = await prisma.site.create({
      data: {
        name: home.name,
        address: `${home.town}, Suffolk`,
        description: home.description,
      },
    })

    // Bedrooms split evenly across two floors, matching how these homes are laid out.
    const half = Math.ceil(home.residents / 2)
    const bedrooms = Array.from({ length: home.residents }, (_, i) => {
      const n = i + 1
      return {
        name: `Bedroom ${n}`,
        type: RoomType.BEDROOM,
        floor: n <= half ? 'Ground Floor' : 'First Floor',
        description: null as string | null,
        siteId: site.id,
      }
    })

    const communal = communalRooms(home).map((r) => ({
      name: r.name,
      type: r.type,
      floor: r.floor,
      description: r.description,
      siteId: site.id,
    }))

    await prisma.room.createMany({ data: [...bedrooms, ...communal] })
    totalRooms += bedrooms.length + communal.length

    console.log(
      `${home.name.padEnd(22)} ${home.town.padEnd(12)} ${String(bedrooms.length).padStart(3)} bedrooms + ${communal.length} communal` +
        (home.nursing ? '  [nursing]' : '')
    )
  }

  console.log(`\n6 homes, ${totalRooms} rooms total.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
