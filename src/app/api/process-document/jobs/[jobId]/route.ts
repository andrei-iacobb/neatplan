import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/authz'

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const auth = await requireAuth()
    if ("error" in auth) return auth.error

    const { jobId } = await context.params
    const job = await prisma.documentJob.findFirst({
      where: { id: jobId, userId: auth.user.id },
    })

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      fileName: job.fileName,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch job status' }, { status: 500 })
  }
}
