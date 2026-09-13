import 'server-only'

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

/**
 * Storage for equipment identification photos.
 *
 * These say what a piece of equipment looks like, where its serial plate is, and
 * which of four identical hoists this one is. They are NOT evidence that a clean
 * happened - nothing in the completion path reads them - and keeping that line
 * clear is deliberate. A photo attached to a completion would be a compliance
 * record, with the retention and consent that implies. This is a picture of a
 * hoover.
 *
 * Follows the floor-plan image path deliberately rather than inventing a second
 * convention: same data volume, same magic-byte check, same traversal guard.
 */

const DATA_DIR = process.env.NEATPLAN_DATA_DIR || path.join(process.cwd(), 'data')
const EQUIPMENT_PHOTOS_DIR = path.join(DATA_DIR, 'equipment-photos')

/**
 * 12 MB in, which comfortably covers a modern phone camera. The stored file is
 * far smaller - everything is re-encoded below.
 */
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024

/**
 * Long edge after resize. A photo of an asset plate has to stay readable when a
 * manager pinches in on a tablet; past this is storage spent on nothing.
 */
const MAX_EDGE = 1600

/**
 * Four per item. Enough for the item, its plate, and two awkward angles - and a
 * bound so an equipment record cannot become a photo album.
 */
export const MAX_PHOTOS_PER_ITEM = 4

/** sharp will refuse a decompression bomb rather than allocating for it. */
const MAX_INPUT_PIXELS = 50_000_000

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export class EquipmentPhotoError extends Error {}

export interface ProcessedEquipmentPhoto {
  bytes: Buffer
  mimeType: 'image/webp'
  width: number
  height: number
  byteSize: number
}

/**
 * Does the content match what the upload claims to be?
 *
 * A declared content type is just a string the client chose. Checking the leading
 * bytes is what stops a renamed script or a polyglot file being written into the
 * data volume.
 */
function hasSupportedMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return true
  }

  // RIFF....WEBP
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
    return true
  }

  // HEIC/HEIF: an ISO-BMFF box whose brand starts "ftyp" then heic/heix/mif1/msf1.
  if (buffer.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('latin1')
    if (['heic', 'heix', 'hevc', 'mif1', 'msf1', 'heim', 'heis'].includes(brand)) return true
  }

  return false
}

/**
 * Validate and normalise an uploaded photo.
 *
 * Everything is re-encoded through sharp rather than being stored as it arrived.
 * That does three jobs at once: it guarantees the bytes on disk really are an
 * image, it drops every metadata block - and a phone photo taken in a care home
 * carries GPS coordinates and a device identifier in EXIF, which have no business
 * being kept - and it normalises HEIC from an iPhone into something a browser can
 * actually display.
 *
 * `.rotate()` before resizing bakes in the EXIF orientation, so a photo taken
 * sideways is not stored sideways once that tag is stripped.
 */
export async function processEquipmentPhoto(file: File): Promise<ProcessedEquipmentPhoto> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new EquipmentPhotoError('Upload a photo as JPEG, PNG, WebP or HEIC.')
  }

  if (file.size <= 0) {
    throw new EquipmentPhotoError('That file is empty.')
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new EquipmentPhotoError('Photos must be smaller than 12 MB.')
  }

  const input = Buffer.from(await file.arrayBuffer())

  // The declared size is also just a claim; check what actually arrived.
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new EquipmentPhotoError('Photos must be smaller than 12 MB.')
  }

  if (!hasSupportedMagicBytes(input)) {
    throw new EquipmentPhotoError('That file is not a photo we can read.')
  }

  let bytes: Buffer
  try {
    bytes = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
  } catch {
    throw new EquipmentPhotoError('That photo could not be read. Try taking it again.')
  }

  const metadata = await sharp(bytes).metadata()
  if (!metadata.width || !metadata.height) {
    throw new EquipmentPhotoError('That photo could not be read. Try taking it again.')
  }

  return {
    bytes,
    mimeType: 'image/webp',
    width: metadata.width,
    height: metadata.height,
    byteSize: bytes.byteLength,
  }
}

/**
 * Reject any path that is not inside the equipment photo directory.
 *
 * The stored path comes from our own database, but a row is still data, and the
 * cost of being wrong here is reading an arbitrary file off the server.
 */
function assertStoredPath(filePath: string): string {
  const root = path.resolve(EQUIPMENT_PHOTOS_DIR)
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new EquipmentPhotoError('Stored photo path is invalid.')
  }
  return resolved
}

export async function storeEquipmentPhoto(equipmentId: string, bytes: Buffer): Promise<string> {
  // The equipment id comes from a route param, so it is never used as a path
  // segment without being reduced to its basename first.
  const safeId = path.basename(equipmentId)
  const directory = path.join(EQUIPMENT_PHOTOS_DIR, safeId)
  assertStoredPath(path.join(directory, 'probe'))

  await fs.mkdir(directory, { recursive: true })
  const filePath = path.join(directory, `${randomUUID()}.webp`)
  // wx fails rather than overwriting, so a uuid collision cannot silently
  // replace another item's photo.
  await fs.writeFile(filePath, bytes, { flag: 'wx' })
  return filePath
}

export async function readEquipmentPhoto(filePath: string): Promise<Buffer> {
  return fs.readFile(assertStoredPath(filePath))
}

export async function removeEquipmentPhoto(filePath: string): Promise<void> {
  try {
    await fs.rm(assertStoredPath(filePath), { force: true })
  } catch {
    // The database stays authoritative. A file already gone must not make
    // deleting the row fail, or the record becomes impossible to remove.
  }
}

export async function removeEquipmentPhotoDirectory(equipmentId: string): Promise<void> {
  const directory = assertStoredPath(path.join(EQUIPMENT_PHOTOS_DIR, path.basename(equipmentId)))
  await fs.rm(directory, { recursive: true, force: true })
}
