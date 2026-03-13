import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { emailService } from '@/lib/email'

export async function GET(request: Request) {
  try {
    // Protect cron route: require shared secret via header only
    const providedSecret = request.headers.get('x-cron-secret')
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Mark overdue RoomSchedules
    const overdueRoomSchedules = await prisma.roomSchedule.updateMany({
      where: {
        nextDue: {
          lt: now
        },
        status: {
          not: 'COMPLETED'
        }
      },
      data: {
        status: 'OVERDUE'
      }
    })

    // Mark overdue EquipmentSchedules
    const overdueEquipmentSchedules = await prisma.equipmentSchedule.updateMany({
      where: {
        nextDue: {
          lt: now
        },
        status: {
          not: 'COMPLETED'
        }
      },
      data: {
        status: 'OVERDUE'
      }
    })

    const roomCount = overdueRoomSchedules.count
    const equipmentCount = overdueEquipmentSchedules.count
    const totalOverdue = roomCount + equipmentCount

    // Send email alerts to admins if any items were newly marked overdue
    if (totalOverdue > 0) {
      const adminUsers = await prisma.user.findMany({
        where: { isAdmin: true }
      })

      const message = `${roomCount} room schedule(s) and ${equipmentCount} equipment schedule(s) are now overdue. Please check the dashboard.`

      for (const admin of adminUsers) {
        await emailService.sendSystemAlert(admin.email, {
          userName: admin.name || 'Admin',
          alertType: 'Overdue Schedules',
          message
        })
      }
    }

    return NextResponse.json({
      message: `Updated ${roomCount} overdue room schedules and ${equipmentCount} overdue equipment schedules`,
      roomCount,
      equipmentCount,
      totalOverdue
    })
  } catch (error) {
    console.error('Error checking schedules:', error)
    return NextResponse.json(
      { error: 'Failed to check schedules' },
      { status: 500 }
    )
  }
}
