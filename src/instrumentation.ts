/**
 * Next.js instrumentation hook. Next compiles this file for BOTH the Node and Edge
 * runtimes, so the Node-only scheduler (which pulls in nodemailer / Node core modules) must
 * be loaded through a dynamic import guarded by an `=== 'nodejs'` check - that exact shape
 * is what lets the edge bundler drop it instead of trying (and failing) to resolve 'stream'.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('@/lib/scheduler')
    startScheduler()
  }
}
