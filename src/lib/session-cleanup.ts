import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

const SESSION_RETENTION_DAYS = Number(process.env.SESSION_RETENTION_DAYS || 90)

export async function cleanupStaleSessions(): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - SESSION_RETENTION_DAYS)

  const result = await prisma.userSession.deleteMany({
    where: {
      OR: [
        { isActive: false, logoutAt: { lt: cutoff } },
        { isActive: false, lastActivity: { lt: cutoff } },
        { isActive: true, lastActivity: { lt: cutoff } },
      ],
    },
  })

  if (result.count > 0) {
    logger.info(`Cleaned up ${result.count} stale sessions older than ${SESSION_RETENTION_DAYS} days`)
  }

  return result.count
}
