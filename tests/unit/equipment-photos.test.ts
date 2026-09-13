import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'

/**
 * The data directory is read from the environment when the module loads, so it
 * has to be pointed at a scratch directory before the import.
 */
const SCRATCH = await fs.mkdtemp(path.join(os.tmpdir(), 'neatplan-photo-test-'))
process.env.NEATPLAN_DATA_DIR = SCRATCH

const {
  EquipmentPhotoError,
  MAX_PHOTOS_PER_ITEM,
  processEquipmentPhoto,
  storeEquipmentPhoto,
  readEquipmentPhoto,
  removeEquipmentPhoto,
  removeEquipmentPhotoDirectory,
} = await import('@/lib/equipment-photos')

/** A real encoded image, not a stub - the whole point is that sharp reads it. */
async function makeImage(
  format: 'jpeg' | 'png' | 'webp',
  width = 800,
  height = 600
): Promise<Buffer> {
  const image = sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 140, b: 160 } },
  })
  if (format === 'jpeg') return image.jpeg().toBuffer()
  if (format === 'png') return image.png().toBuffer()
  return image.webp().toBuffer()
}

function asFile(bytes: Buffer, type: string, name = 'photo'): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

let photoFixtures: { jpeg: Buffer; png: Buffer; webp: Buffer }

beforeAll(async () => {
  photoFixtures = {
    jpeg: await makeImage('jpeg'),
    png: await makeImage('png'),
    webp: await makeImage('webp'),
  }
})

afterAll(async () => {
  await fs.rm(SCRATCH, { recursive: true, force: true })
})

describe('accepting a photo', () => {
  it('takes the formats a phone actually produces', async () => {
    for (const [format, type] of [
      ['jpeg', 'image/jpeg'],
      ['png', 'image/png'],
      ['webp', 'image/webp'],
    ] as const) {
      const result = await processEquipmentPhoto(asFile(photoFixtures[format], type))
      expect(result.mimeType, format).toBe('image/webp')
      expect(result.byteSize).toBeGreaterThan(0)
    }
  })

  it('normalises everything to one stored format', async () => {
    // A browser cannot display HEIC from an iPhone, so storing what arrived would
    // mean some photos silently never render.
    const result = await processEquipmentPhoto(asFile(photoFixtures.png, 'image/png'))
    expect(result.mimeType).toBe('image/webp')

    const metadata = await sharp(result.bytes).metadata()
    expect(metadata.format).toBe('webp')
  })

  it('shrinks a large photo instead of storing it whole', async () => {
    const huge = await makeImage('jpeg', 4000, 3000)
    const result = await processEquipmentPhoto(asFile(huge, 'image/jpeg'))

    expect(Math.max(result.width, result.height)).toBeLessThanOrEqual(1600)
    expect(result.byteSize).toBeLessThan(huge.byteLength)
  })

  it('leaves a small photo alone rather than enlarging it', async () => {
    const small = await makeImage('png', 320, 240)
    const result = await processEquipmentPhoto(asFile(small, 'image/png'))

    expect(result.width).toBe(320)
    expect(result.height).toBe(240)
  })
})

describe('stripping what should not be kept', () => {
  it('drops EXIF, including the GPS fix a phone attaches', async () => {
    // A photo taken in a care home carries coordinates and a device id. Those
    // have no business being kept on an asset record, and re-encoding is what
    // removes them.
    const withExif = await sharp({
      create: { width: 600, height: 400, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      // sharp's Exif type covers the standard IFDs; GPS travels in the same
      // block, and the assertion below is that the whole block is gone.
      .withExif({
        IFD0: { Copyright: 'Test', Make: 'TestPhone', Model: 'Pixel' },
        IFD2: { GPSLatitudeRef: 'N', GPSLongitudeRef: 'W' },
      })
      .jpeg()
      .toBuffer()

    const before = await sharp(withExif).metadata()
    expect(before.exif, 'fixture should carry EXIF to begin with').toBeDefined()

    const result = await processEquipmentPhoto(asFile(withExif, 'image/jpeg'))
    const after = await sharp(result.bytes).metadata()

    expect(after.exif).toBeUndefined()
  })

  it('bakes in the orientation before the tag is discarded', async () => {
    // Otherwise a photo taken sideways is stored sideways, because the tag that
    // said to rotate it is stripped along with the rest of the EXIF.
    const rotated = await sharp({
      create: { width: 800, height: 400, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .withMetadata({ orientation: 6 }) // 90 degrees clockwise
      .jpeg()
      .toBuffer()

    const result = await processEquipmentPhoto(asFile(rotated, 'image/jpeg'))

    // 800x400 rotated a quarter turn is taller than it is wide.
    expect(result.height).toBeGreaterThan(result.width)
  })
})

describe('refusing a photo', () => {
  it('refuses a type we do not handle', async () => {
    await expect(
      processEquipmentPhoto(asFile(photoFixtures.png, 'application/pdf'))
    ).rejects.toBeInstanceOf(EquipmentPhotoError)
  })

  it('refuses content that does not match its declared type', async () => {
    // The attack: rename a script to .jpg and declare image/jpeg. The declared
    // type is a string the client chose; the leading bytes are not.
    const script = Buffer.from('#!/bin/sh\nrm -rf /\n', 'utf8')

    await expect(processEquipmentPhoto(asFile(script, 'image/jpeg'))).rejects.toThrow(
      /not a photo we can read/
    )
  })

  it('refuses an HTML polyglot declared as an image', async () => {
    const polyglot = Buffer.from('<html><script>alert(1)</script></html>', 'utf8')
    await expect(processEquipmentPhoto(asFile(polyglot, 'image/png'))).rejects.toThrow(
      /not a photo we can read/
    )
  })

  it('refuses an empty file', async () => {
    await expect(processEquipmentPhoto(asFile(Buffer.alloc(0), 'image/png'))).rejects.toThrow(
      /empty/
    )
  })

  it('refuses something past the size ceiling', async () => {
    const oversized = Buffer.alloc(13 * 1024 * 1024)
    // Give it a real PNG header so it is the SIZE being refused, not the content.
    photoFixtures.png.copy(oversized, 0, 0, 32)

    await expect(processEquipmentPhoto(asFile(oversized, 'image/png'))).rejects.toThrow(/12 MB/)
  })

  it('refuses a truncated file that claims to be an image', async () => {
    const truncated = photoFixtures.jpeg.subarray(0, 40)
    await expect(processEquipmentPhoto(asFile(truncated, 'image/jpeg'))).rejects.toBeInstanceOf(
      EquipmentPhotoError
    )
  })
})

describe('storage', () => {
  it('round-trips the bytes it stored', async () => {
    const processed = await processEquipmentPhoto(asFile(photoFixtures.jpeg, 'image/jpeg'))
    const stored = await storeEquipmentPhoto('equip-1', processed.bytes)

    expect(stored).toContain('equipment-photos')
    expect(await readEquipmentPhoto(stored)).toEqual(processed.bytes)
  })

  it('keeps each item photos in its own directory', async () => {
    const processed = await processEquipmentPhoto(asFile(photoFixtures.png, 'image/png'))
    const a = await storeEquipmentPhoto('equip-a', processed.bytes)
    const b = await storeEquipmentPhoto('equip-b', processed.bytes)

    expect(path.dirname(a)).not.toBe(path.dirname(b))
  })

  it('never writes outside the photo directory, whatever the id looks like', async () => {
    const processed = await processEquipmentPhoto(asFile(photoFixtures.png, 'image/png'))
    const stored = await storeEquipmentPhoto('../../../etc/passwd', processed.bytes)

    expect(path.resolve(stored).startsWith(path.resolve(SCRATCH))).toBe(true)
    expect(stored).not.toContain('etc/passwd')
  })

  it('refuses to read a path outside the photo directory', async () => {
    // The stored path comes from our own database, but a row is still data and
    // the cost of being wrong is reading an arbitrary file off the server.
    await expect(readEquipmentPhoto('/etc/passwd')).rejects.toBeInstanceOf(EquipmentPhotoError)
    await expect(
      readEquipmentPhoto(path.join(SCRATCH, 'equipment-photos', '..', '..', 'escape.txt'))
    ).rejects.toBeInstanceOf(EquipmentPhotoError)
  })

  it('refuses to delete a path outside the photo directory', async () => {
    const bystander = path.join(SCRATCH, 'do-not-delete.txt')
    await fs.writeFile(bystander, 'still here')

    await removeEquipmentPhoto(bystander)

    // removeEquipmentPhoto swallows its own errors so a missing file cannot block
    // deleting a row - the assertion is that the file survived.
    expect(await fs.readFile(bystander, 'utf8')).toBe('still here')
  })

  it('does not fail when the file is already gone', async () => {
    await expect(
      removeEquipmentPhoto(path.join(SCRATCH, 'equipment-photos', 'x', 'missing.webp'))
    ).resolves.toBeUndefined()
  })

  it('removes an item whole directory', async () => {
    const processed = await processEquipmentPhoto(asFile(photoFixtures.png, 'image/png'))
    const stored = await storeEquipmentPhoto('equip-gone', processed.bytes)

    await removeEquipmentPhotoDirectory('equip-gone')
    await expect(fs.access(stored)).rejects.toThrow()
  })
})

describe('limits', () => {
  it('bounds an equipment record to a handful of photos', () => {
    // Four: the item, its plate, and two awkward angles. A bound so an equipment
    // record cannot quietly become a photo album.
    expect(MAX_PHOTOS_PER_ITEM).toBe(4)
  })
})
