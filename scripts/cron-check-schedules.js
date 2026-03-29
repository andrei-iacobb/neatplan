/**
 * PM2 cron job: calls /api/cron/check-schedules with the CRON_SECRET header.
 * Runs via PM2 cron_restart in ecosystem.config.js.
 */

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:4040'
const CRON_SECRET = process.env.CRON_SECRET

if (!CRON_SECRET) {
  console.error('[cron] CRON_SECRET not set, skipping schedule check')
  process.exit(1)
}

async function run() {
  try {
    const url = `${BASE_URL}/api/cron/check-schedules`
    console.log(`[cron] Calling ${url}`)

    const res = await fetch(url, {
      method: 'GET',
      headers: { 'x-cron-secret': CRON_SECRET },
    })

    const body = await res.text()

    if (!res.ok) {
      console.error(`[cron] Failed (${res.status}): ${body}`)
      process.exit(1)
    }

    console.log(`[cron] Success: ${body}`)
  } catch (err) {
    console.error('[cron] Error:', err.message)
    process.exit(1)
  }
}

run()
