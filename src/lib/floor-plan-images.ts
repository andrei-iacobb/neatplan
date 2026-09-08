import 'server-only'

import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { loadPdfParser } from '@/lib/pdf'

const DATA_DIR = process.env.NEATPLAN_DATA_DIR || path.join(process.cwd(), 'data')
const FLOOR_PLANS_DIR = path.join(DATA_DIR, 'floor-plans')
const MAX_FLOOR_PLAN_SIZE = 10 * 1024 * 1024
const MAX_RENDER_WIDTH = 2400

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
])

export class FloorPlanImageError extends Error {}

export type ProcessedFloorPlanImage = {
  bytes: Buffer
  mimeType: 'image/png'
  width: number
  height: number
  sourceFileName: string
}

function hasSupportedMagicBytes(buffer: Buffer, claimedType: string): boolean {
  if (claimedType === 'application/pdf') return buffer.subarray(0, 4).toString() === '%PDF'
  if (claimedType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8
  if (claimedType === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  }
  if (claimedType === 'image/webp') {
    return buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
  }
  return false
}

async function renderPdfFirstPage(buffer: Buffer): Promise<Buffer> {
  const { PDFParse } = await loadPdfParser()
  const parser = new PDFParse({ data: buffer })
  try {
    const screenshot = await parser.getScreenshot({
      first: 1,
      desiredWidth: MAX_RENDER_WIDTH,
      imageBuffer: true,
      imageDataUrl: false,
    })
    const firstPage = screenshot.pages[0]
    if (!firstPage?.data?.length) throw new FloorPlanImageError('The first PDF page could not be rendered.')
    return Buffer.from(firstPage.data)
  } catch (error) {
    if (error instanceof FloorPlanImageError) throw error
    throw new FloorPlanImageError('The first PDF page could not be rendered.')
  } finally {
    await parser.destroy().catch(() => undefined)
  }
}

export async function processFloorPlanFile(file: File): Promise<ProcessedFloorPlanImage> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new FloorPlanImageError('Upload a PNG, JPEG, WebP or PDF floor plan.')
  }
  if (file.size <= 0 || file.size > MAX_FLOOR_PLAN_SIZE) {
    throw new FloorPlanImageError('Floor plans must be smaller than 10 MB.')
  }

  const input = Buffer.from(await file.arrayBuffer())
  if (!hasSupportedMagicBytes(input, file.type)) {
    throw new FloorPlanImageError('The file content does not match its declared format.')
  }

  const rasterInput = file.type === 'application/pdf' ? await renderPdfFirstPage(input) : input
  let output: Buffer
  try {
    output = await sharp(rasterInput, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: MAX_RENDER_WIDTH, height: MAX_RENDER_WIDTH, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .png({ compressionLevel: 9 })
      .toBuffer()
  } catch {
    throw new FloorPlanImageError('The floor plan image could not be read.')
  }

  const metadata = await sharp(output).metadata()
  if (!metadata.width || !metadata.height) {
    throw new FloorPlanImageError('The floor plan has invalid dimensions.')
  }

  return {
    bytes: output,
    mimeType: 'image/png',
    width: metadata.width,
    height: metadata.height,
    sourceFileName: path.basename(file.name).slice(0, 180) || 'floor-plan',
  }
}

function assertStoredPath(filePath: string): string {
  const root = path.resolve(FLOOR_PLANS_DIR)
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new FloorPlanImageError('Stored floor plan path is invalid.')
  }
  return resolved
}

export async function storeFloorPlanImage(planId: string, bytes: Buffer): Promise<string> {
  const planDirectory = path.join(FLOOR_PLANS_DIR, planId)
  await fs.mkdir(planDirectory, { recursive: true })
  const filePath = path.join(planDirectory, `${randomUUID()}.png`)
  await fs.writeFile(filePath, bytes, { flag: 'wx' })
  return filePath
}

export async function readFloorPlanImage(filePath: string): Promise<Buffer> {
  return fs.readFile(assertStoredPath(filePath))
}

export async function removeFloorPlanImage(filePath: string): Promise<void> {
  try {
    await fs.rm(assertStoredPath(filePath), { force: true })
  } catch {
    // The database remains authoritative. Missing old files do not make a replacement fail.
  }
}

export async function removeFloorPlanDirectory(planId: string): Promise<void> {
  const directory = assertStoredPath(path.join(FLOOR_PLANS_DIR, planId))
  await fs.rm(directory, { recursive: true, force: true })
}
