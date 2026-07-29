import type { Transition, Variants } from 'framer-motion'

/**
 * Canonical motion values for the whole app.
 *
 * Every page used to declare its own `fadeUp` and pick its own duration and
 * delay, so the same entrance read differently on every route. These are the
 * only values any surface should use.
 *
 * Reduced motion is handled centrally and does not need repeating here:
 *  - framer-motion animations go through `<MotionConfig>` in settings-context.
 *  - CSS animations/transitions are clamped by the `prefers-reduced-motion`
 *    block and the `.reduce-motion` class in globals.css.
 */

/** Standard UI easing. Matches the --ease-snappy design token. */
export const EASE_SNAPPY = [0.2, 0.8, 0.2, 1] as const

export const DURATION = {
  /** Hover, focus and colour shifts. */
  micro: 0.15,
  /** Dialog and popover enter/exit. */
  fast: 0.2,
  /** Page and section entrances. Ceiling for any UI transition. */
  base: 0.3,
} as const

/** Gap between staggered siblings. */
export const STAGGER_STEP = 0.04

/** Past this many siblings the stagger stops growing, so long lists stay fast. */
const MAX_STAGGER_INDEX = 8

/** The entrance. Used by every page-level and card-level reveal. */
export const fadeUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
}

/** Opacity-only entrance, for elements that must not shift position. */
export const fade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
}

/**
 * Transition for an entrance. Pass the element's position in its group to
 * stagger it: `enter()` for the first, `enter(1)` for the next, and so on.
 */
export function enter(index = 0): Transition {
  return {
    duration: DURATION.base,
    delay: Math.min(index, MAX_STAGGER_INDEX) * STAGGER_STEP,
    ease: EASE_SNAPPY,
  }
}

/** Transition for state changes that are not entrances (tabs, expanding rows). */
export const transitionFast: Transition = {
  duration: DURATION.fast,
  ease: EASE_SNAPPY,
}
