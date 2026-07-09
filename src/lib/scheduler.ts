import { runScheduleCheck } from '@/lib/schedule-check'
import { logger } from '@/lib/logger'

/**
 * Start the in-process scheduler so overdue-schedule detection and admin alerts fire on all
 * self-hosted deployment targets (Docker, PM2, Windows NSSM), not only on platforms that
 * provide an external cron. Safe to call more than once - it self-guards against duplicate
 * timers. Loaded only from the Node.js runtime (see src/instrumentation.ts).
 *
 * Env:
 *   SCHEDULER_ENABLED               - "false" disables the in-process scheduler (default on)
 *   SCHEDULE_CHECK_INTERVAL_MINUTES - interval in minutes (default 15, min 1)
 */
export function startScheduler(): void {
  if (process.env.SCHEDULER_ENABLED === 'false') return

  const globalScope = globalThis as unknown as { __neatplanScheduler?: NodeJS.Timeout }
  if (globalScope.__neatplanScheduler) return

  const intervalMinutes = Math.max(1, Number(process.env.SCHEDULE_CHECK_INTERVAL_MINUTES) || 15)
  const intervalMs = intervalMinutes * 60 * 1000

  let running = false
  const tick = async () => {
    // Never overlap runs - a slow email round or DB call must not stack ticks.
    if (running) return
    running = true
    try {
      const result = await runScheduleCheck()
      if (result.totalOverdue > 0 || result.emailsFailed > 0 || result.sessionsCleaned > 0) {
        logger.info(
          `[scheduler] overdue=${result.totalOverdue} emailsSent=${result.emailsSent} ` +
            `emailsFailed=${result.emailsFailed} sessionsCleaned=${result.sessionsCleaned}`
        )
      }
    } catch (err) {
      logger.error('[scheduler] schedule check failed', err)
    } finally {
      running = false
    }
  }

  const timer = setInterval(tick, intervalMs)
  // Do not keep the event loop alive solely for the scheduler (clean shutdown).
  if (typeof timer.unref === 'function') timer.unref()
  globalScope.__neatplanScheduler = timer

  // Run a first pass shortly after boot so overdue state is fresh without waiting a full
  // interval; never block startup on it.
  setTimeout(() => { void tick() }, 10_000)
  logger.info(`[scheduler] in-process scheduler started; interval=${intervalMinutes}m`)
}
