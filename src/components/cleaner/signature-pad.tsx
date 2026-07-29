'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Eraser, PenLine, CheckCircle2 } from 'lucide-react'
import { useThemeColors } from '@/hooks/useThemeColors'

type Point = { x: number; y: number }
type Stroke = Point[]

/** Minimum sampled points across all strokes before we treat the canvas as signed. */
const MIN_POINTS = 12
/** Minimum diagonal (in CSS px) of the ink bounding box - blocks a single dot or tap. */
const MIN_INK_SPAN = 40
/** Server rejects anything at or above 100KB; stay comfortably under. */
const MAX_BYTES = 90_000
const EXPORT_MAX_WIDTH = 640
const EXPORT_PADDING = 12
const LINE_WIDTH = 2.4
const EXPORT_INK = '#111118'
const EXPORT_BG = '#ffffff'

export interface SignaturePadProps {
  /** PNG data URL, or null when the pad is empty. Setting null externally clears the pad. */
  value: string | null
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
  /** Rendered above the pad. */
  label?: string
  /** Marks the pad as failing validation and announces the reason. */
  invalid?: boolean
}

function estimateBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.floor((base64.length * 3) / 4)
}

/** Draws the stroke set onto a context using midpoint quadratic smoothing. */
function paintStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  toX: (n: number) => number,
  toY: (n: number) => number,
  lineWidth: number,
  color: string
) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth

  for (const stroke of strokes) {
    if (stroke.length === 0) continue

    if (stroke.length < 3) {
      // A tap or a two-point flick: render as a short cap so it is still visible.
      ctx.beginPath()
      ctx.moveTo(toX(stroke[0].x), toY(stroke[0].y))
      const last = stroke[stroke.length - 1]
      ctx.lineTo(toX(last.x), toY(last.y))
      ctx.stroke()
      continue
    }

    ctx.beginPath()
    ctx.moveTo(toX(stroke[0].x), toY(stroke[0].y))
    for (let i = 1; i < stroke.length - 1; i++) {
      const midX = (stroke[i].x + stroke[i + 1].x) / 2
      const midY = (stroke[i].y + stroke[i + 1].y) / 2
      ctx.quadraticCurveTo(toX(stroke[i].x), toY(stroke[i].y), toX(midX), toY(midY))
    }
    const penultimate = stroke[stroke.length - 2]
    const final = stroke[stroke.length - 1]
    ctx.quadraticCurveTo(toX(penultimate.x), toY(penultimate.y), toX(final.x), toY(final.y))
    ctx.stroke()
  }
}

export function SignaturePad({
  value,
  onChange,
  disabled = false,
  label = 'Signature',
  invalid = false
}: SignaturePadProps) {
  const tc = useThemeColors()
  const reactId = useId()
  const labelId = `${reactId}-label`
  const hintId = `${reactId}-hint`
  const statusId = `${reactId}-status`

  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Strokes are stored normalised (0-1) so a resize or rotation re-renders cleanly.
  const strokesRef = useRef<Stroke[]>([])
  const drawingRef = useRef(false)
  const sizeRef = useRef({ width: 0, height: 0 })

  const [hasInk, setHasInk] = useState(false)

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const { width, height } = sizeRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 3)

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(dpr, dpr)

    paintStrokes(
      ctx,
      strokesRef.current,
      (n) => n * width,
      (n) => n * height,
      LINE_WIDTH,
      tc.textPrimary
    )
  }, [tc.textPrimary])

  // Size the backing store to devicePixelRatio so strokes are crisp on phones.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      sizeRef.current = { width: rect.width, height: rect.height }
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      render()
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    window.addEventListener('orientationchange', resize)
    return () => {
      observer.disconnect()
      window.removeEventListener('orientationchange', resize)
    }
  }, [render])

  useEffect(() => {
    render()
  }, [render])

  /** Ink bounding box in normalised units, or null when there is not enough ink. */
  const measureInk = useCallback((): { minX: number; minY: number; maxX: number; maxY: number } | null => {
    const strokes = strokesRef.current
    const totalPoints = strokes.reduce((sum, s) => sum + s.length, 0)
    if (totalPoints < MIN_POINTS) return null

    let minX = 1
    let minY = 1
    let maxX = 0
    let maxY = 0
    for (const stroke of strokes) {
      for (const p of stroke) {
        if (p.x < minX) minX = p.x
        if (p.x > maxX) maxX = p.x
        if (p.y < minY) minY = p.y
        if (p.y > maxY) maxY = p.y
      }
    }

    const { width, height } = sizeRef.current
    const spanX = (maxX - minX) * width
    const spanY = (maxY - minY) * height
    if (Math.hypot(spanX, spanY) < MIN_INK_SPAN) return null

    return { minX, minY, maxX, maxY }
  }, [])

  /** Trims to the ink bounding box, renders dark-on-white, and shrinks until under the size cap. */
  const exportPng = useCallback((): string | null => {
    const box = measureInk()
    if (!box) return null

    const { width, height } = sizeRef.current
    if (width === 0 || height === 0) return null

    const inkWidth = Math.max((box.maxX - box.minX) * width, 1) + EXPORT_PADDING * 2
    const inkHeight = Math.max((box.maxY - box.minY) * height, 1) + EXPORT_PADDING * 2
    const offsetX = box.minX * width - EXPORT_PADDING
    const offsetY = box.minY * height - EXPORT_PADDING

    let scale = Math.min(1, EXPORT_MAX_WIDTH / inkWidth)

    for (let attempt = 0; attempt < 5; attempt++) {
      const out = document.createElement('canvas')
      out.width = Math.max(Math.round(inkWidth * scale), 1)
      out.height = Math.max(Math.round(inkHeight * scale), 1)
      const ctx = out.getContext('2d')
      if (!ctx) return null

      ctx.fillStyle = EXPORT_BG
      ctx.fillRect(0, 0, out.width, out.height)

      paintStrokes(
        ctx,
        strokesRef.current,
        (n) => (n * width - offsetX) * scale,
        (n) => (n * height - offsetY) * scale,
        Math.max(LINE_WIDTH * scale, 1),
        EXPORT_INK
      )

      const dataUrl = out.toDataURL('image/png')
      if (estimateBytes(dataUrl) <= MAX_BYTES) return dataUrl
      scale *= 0.7
    }

    return null
  }, [measureInk])

  const commit = useCallback(() => {
    const dataUrl = exportPng()
    setHasInk(dataUrl !== null)
    onChange(dataUrl)
  }, [exportPng, onChange])

  const clear = useCallback(() => {
    strokesRef.current = []
    drawingRef.current = false
    setHasInk(false)
    render()
    onChange(null)
  }, [onChange, render])

  // Allow the parent to reset the pad by setting value back to null.
  useEffect(() => {
    if (value === null && strokesRef.current.length > 0) {
      strokesRef.current = []
      setHasInk(false)
      render()
    }
  }, [value, render])

  const pointFromEvent = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1)
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    strokesRef.current = [...strokesRef.current, [pointFromEvent(e)]]
    render()
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || disabled) return
    e.preventDefault()

    const stroke = strokesRef.current[strokesRef.current.length - 1]
    if (!stroke) return

    // Coalesced events keep fast strokes smooth on high-report-rate touchscreens.
    const native = e.nativeEvent
    const events =
      typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []

    if (events.length > 1) {
      const rect = e.currentTarget.getBoundingClientRect()
      for (const ev of events) {
        stroke.push({
          x: Math.min(Math.max((ev.clientX - rect.left) / rect.width, 0), 1),
          y: Math.min(Math.max((ev.clientY - rect.top) / rect.height, 0), 1)
        })
      }
    } else {
      stroke.push(pointFromEvent(e))
    }

    render()
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return
    drawingRef.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    commit()
  }

  const borderColor = invalid
    ? tc.statusOverdue.border
    : hasInk
      ? tc.statusCompleted.border
      : tc.inputBorder

  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <legend className="contents">
          <span id={labelId} className="text-sm font-medium" style={{ color: tc.textSecondary }}>
            {label} <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </span>
        </legend>

        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasInk}
          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40"
          style={{
            background: tc.btnSecondaryBg,
            color: tc.btnSecondaryText,
            border: '1px solid ' + tc.btnSecondaryBorder,
            // @ts-expect-error - CSS custom property for the shared focus ring colour
            '--tw-ring-color': tc.inputFocusBorder
          }}
        >
          <Eraser className="h-4 w-4" aria-hidden="true" />
          Clear
          <span className="sr-only">signature</span>
        </button>
      </div>

      <div
        className="relative overflow-hidden rounded-xl"
        style={{ background: tc.inputBg, border: '1px solid ' + borderColor }}
      >
        {/* Baseline and prompt sit behind the canvas so they never end up in the exported PNG. */}
        <div className="pointer-events-none absolute inset-x-4 bottom-9 flex items-center gap-2">
          <span className="text-lg leading-none" style={{ color: tc.textFaint }} aria-hidden="true">
            &times;
          </span>
          <span className="h-px flex-1" style={{ background: tc.divider }} aria-hidden="true" />
        </div>

        {!hasInk && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <PenLine className="h-5 w-5" style={{ color: tc.textFaint }} aria-hidden="true" />
            <span className="text-sm" style={{ color: tc.textMuted }}>
              Sign here
            </span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          role="application"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-describedby={`${hintId} ${statusId}`}
          aria-invalid={invalid || undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          className="relative block h-48 w-full cursor-crosshair rounded-xl focus-visible:outline-none focus-visible:ring-2 sm:h-56"
          style={{
            // Claims all touch gestures inside the pad so drawing never scrolls the page.
            touchAction: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            // @ts-expect-error - CSS custom property for the shared focus ring colour
            '--tw-ring-color': tc.inputFocusBorder
          }}
        />
      </div>

      <p id={hintId} className="mt-2 text-xs" style={{ color: tc.textMuted }}>
        Sign with your finger, a stylus or a mouse. Use Clear to start again.
      </p>

      {/* Announced on change rather than relying on the border colour alone. */}
      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className="mt-1 flex items-center gap-1.5 text-xs"
        style={{ color: hasInk ? tc.statusCompleted.text : tc.textFaint }}
      >
        {hasInk ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Signature captured
          </>
        ) : (
          'No signature yet'
        )}
      </p>
    </fieldset>
  )
}

export default SignaturePad
