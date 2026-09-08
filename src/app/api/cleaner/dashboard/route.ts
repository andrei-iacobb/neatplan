import { connection, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { siteScopeWhere } from '@/lib/authz'
import { canUseCleaningPortal } from '@/lib/roles'
import { cleanerWorkPriority, combineCleanerWorkPriorities } from '@/lib/cleaner-work-priority'

// Force dynamic rendering

export async function GET() {
  await connection()
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (!canUseCleaningPortal(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Cleaning roles are pinned to one site. siteScopeWhere fails closed when a
    // user has no site assigned.
    const siteWhere = siteScopeWhere(session.user)

    const now = new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Optimized single query to get all rooms with their schedules and tasks
    const rooms = await prisma.room.findMany({
      where: siteWhere,
      include: {
        schedules: {
          include: {
            schedule: {
              include: {
                tasks: true
              }
            }
          },
          where: {
            status: {
              in: ['PENDING', 'OVERDUE', 'COMPLETED']
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // NEW: Get all equipment with their schedules and tasks
    const equipment = await prisma.equipment.findMany({
      where: siteWhere,
      include: {
        serviceArea: { select: { id: true, name: true, floor: true } },
        schedules: {
          include: {
            schedule: {
              include: {
                tasks: true
              }
            }
          },
          where: {
            status: {
              in: ['PENDING', 'OVERDUE', 'COMPLETED']
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Published plans are read alongside the existing room data. The plan never owns
    // schedule state - each marker is decorated from transformedRooms below so the map
    // and list cannot disagree about what is due.
    const floorPlans = await prisma.floorPlan.findMany({
      where: { ...siteWhere, isPublished: true },
      orderBy: { floor: 'asc' },
      select: {
        id: true,
        name: true,
        floor: true,
        imageWidth: true,
        imageHeight: true,
        revision: true,
        regions: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            label: true,
            x: true,
            y: true,
            width: true,
            height: true,
            room: { select: { id: true, name: true, floor: true, type: true } },
          },
        },
      },
    })

    // Get completion stats for today from the completion logs (scoped to the cleaner's
    // site). Completing a schedule re-arms it to PENDING immediately, so counting
    // schedules with status COMPLETED would always return 0 - the logs are the source
    // of truth. Logs whose schedule was deleted (null roomScheduleId) are excluded by
    // the nested relation filter, which is fine for a same-day tally.
    const todayCompletions = await prisma.roomScheduleCompletionLog.count({
      where: {
        completedAt: {
          gte: today,
          lt: tomorrow
        },
        roomSchedule: {
          room: siteWhere
        }
      }
    })

    // NEW: Get equipment completion stats for today (scoped to the cleaner's site)
    const todayEquipmentCompletions = await prisma.equipmentScheduleCompletionLog.count({
      where: {
        completedAt: {
          gte: today,
          lt: tomorrow
        },
        equipmentSchedule: {
          equipment: siteWhere
        }
      }
    })

    // A schedule completed today gets re-armed to PENDING with an advanced nextDue.
    // For the dashboard we still want to present it as COMPLETED (until its next
    // occurrence is actually due), so the room/equipment card doesn't flip straight
    // back to "pending" the moment the cleaner finishes.
    const isCompletedToday = (s: { status: string; lastCompleted: Date | null; nextDue: Date }) =>
      s.status === 'PENDING' &&
      s.lastCompleted !== null &&
      s.lastCompleted >= today &&
      s.nextDue > now

    // Process rooms data in memory (faster than multiple DB calls)
    const transformedRooms = rooms
      .map(room => {
        const allActiveSchedules = room.schedules || []
        
        if (allActiveSchedules.length === 0) return null
        
        // Calculate room priority and stats (schedules completed today are treated as
        // COMPLETED even though they've been re-armed to PENDING)
        const overdueSchedules = allActiveSchedules.filter(s => {
          const nextDue = new Date(s.nextDue)
          return s.status === 'OVERDUE' || (
            s.status === 'PENDING' &&
            !isCompletedToday(s) &&
            nextDue < new Date(now.getTime() - 24 * 60 * 60 * 1000)
          )
        })

        const dueTodaySchedules = allActiveSchedules.filter(s => {
          const nextDue = new Date(s.nextDue)
          return s.status === 'PENDING' &&
                 !isCompletedToday(s) &&
                 nextDue >= today &&
                 nextDue < tomorrow
        })

        const pendingSchedules = allActiveSchedules.filter(s =>
          s.status === 'PENDING' &&
          !isCompletedToday(s) &&
          !overdueSchedules.includes(s) &&
          !dueTodaySchedules.includes(s)
        )

        const completedSchedules = allActiveSchedules.filter(s =>
          s.status === 'COMPLETED' || isCompletedToday(s)
        )
        
        // Determine room priority
        const roomPriority = cleanerWorkPriority(allActiveSchedules, now)
        if (roomPriority === 'NO_WORK') return null
        
        // Calculate totals
        const totalTasks = allActiveSchedules.reduce((acc, schedule) => 
          acc + (schedule.schedule.tasks?.length || 0), 0
        )
        
        const totalEstimatedMinutes = allActiveSchedules.reduce((acc, schedule) => 
          acc + calculateEstimatedDuration(schedule.schedule.tasks || []), 0
        )
        
        const nextDueDates = allActiveSchedules
          .filter(s => s.status === 'PENDING')
          .map(s => new Date(s.nextDue))
        
        const earliestDue = nextDueDates.length > 0 ? 
          new Date(Math.min(...nextDueDates.map(d => d.getTime()))) : 
          new Date()
        
        return {
          id: room.id,
          name: room.name,
          type: room.type,
          floor: room.floor || 'Unknown Floor',
          priority: roomPriority,
          nextDue: earliestDue.toISOString(),
          summary: {
            totalSchedules: allActiveSchedules.length,
            totalTasks: totalTasks,
            estimatedDuration: formatDuration(totalEstimatedMinutes),
            overdueCount: overdueSchedules.length,
            pendingCount: pendingSchedules.length,
            completedCount: completedSchedules.length
          },
          schedules: allActiveSchedules.map(roomSchedule => ({
            id: roomSchedule.id,
            title: roomSchedule.schedule.title,
            frequency: roomSchedule.frequency,
            nextDue: roomSchedule.nextDue.toISOString(),
            status: isCompletedToday(roomSchedule) ? 'COMPLETED' : roomSchedule.status,
            tasksCount: roomSchedule.schedule.tasks?.length || 0,
            estimatedDuration: calculateEstimatedDuration(roomSchedule.schedule.tasks || []),
            scheduleType: determineScheduleType(roomSchedule.schedule.title, roomSchedule.frequency)
          }))
        }
      })
      .filter((room): room is NonNullable<typeof room> => room !== null)

    // NEW: Process equipment data (mirrors room processing)
    const transformedEquipment = equipment
      .map(equip => {
        const allActiveSchedules = equip.schedules || []
        
        if (allActiveSchedules.length === 0) return null
        
        // Calculate equipment priority and stats (same logic as rooms, including the
        // completed-today override for re-armed PENDING schedules)
        const overdueSchedules = allActiveSchedules.filter(s => {
          const nextDue = new Date(s.nextDue)
          return s.status === 'OVERDUE' || (
            s.status === 'PENDING' &&
            !isCompletedToday(s) &&
            nextDue < new Date(now.getTime() - 24 * 60 * 60 * 1000)
          )
        })

        const dueTodaySchedules = allActiveSchedules.filter(s => {
          const nextDue = new Date(s.nextDue)
          return s.status === 'PENDING' &&
                 !isCompletedToday(s) &&
                 nextDue >= today &&
                 nextDue < tomorrow
        })

        const pendingSchedules = allActiveSchedules.filter(s =>
          s.status === 'PENDING' &&
          !isCompletedToday(s) &&
          !overdueSchedules.includes(s) &&
          !dueTodaySchedules.includes(s)
        )

        const completedSchedules = allActiveSchedules.filter(s =>
          s.status === 'COMPLETED' || isCompletedToday(s)
        )
        
        // Determine equipment priority
        const equipmentPriority = cleanerWorkPriority(allActiveSchedules, now)
        if (equipmentPriority === 'NO_WORK') return null
        
        // Calculate totals
        const totalTasks = allActiveSchedules.reduce((acc, schedule) => 
          acc + (schedule.schedule.tasks?.length || 0), 0
        )
        
        const totalEstimatedMinutes = allActiveSchedules.reduce((acc, schedule) => 
          acc + calculateEstimatedDuration(schedule.schedule.tasks || []), 0
        )
        
        const nextDueDates = allActiveSchedules
          .filter(s => s.status === 'PENDING')
          .map(s => new Date(s.nextDue))
        
        const earliestDue = nextDueDates.length > 0 ? 
          new Date(Math.min(...nextDueDates.map(d => d.getTime()))) : 
          new Date()
        
        return {
          id: equip.id,
          name: equip.name,
          type: equip.type,
          assetCode: equip.assetCode,
          serviceArea: equip.serviceArea,
          priority: equipmentPriority,
          nextDue: earliestDue.toISOString(),
          summary: {
            totalSchedules: allActiveSchedules.length,
            totalTasks: totalTasks,
            estimatedDuration: formatDuration(totalEstimatedMinutes),
            overdueCount: overdueSchedules.length,
            pendingCount: pendingSchedules.length,
            completedCount: completedSchedules.length
          },
          schedules: allActiveSchedules.map(equipmentSchedule => ({
            id: equipmentSchedule.id,
            title: equipmentSchedule.schedule.title,
            frequency: equipmentSchedule.frequency,
            nextDue: equipmentSchedule.nextDue.toISOString(),
            status: isCompletedToday(equipmentSchedule) ? 'COMPLETED' : equipmentSchedule.status,
            tasksCount: equipmentSchedule.schedule.tasks?.length || 0,
            estimatedDuration: calculateEstimatedDuration(equipmentSchedule.schedule.tasks || []),
            scheduleType: determineScheduleType(equipmentSchedule.schedule.title, equipmentSchedule.frequency)
          }))
        }
      })
      .filter((equip): equip is NonNullable<typeof equip> => equip !== null)

    // Calculate summary stats (include equipment)
    const stats = {
      totalTasks: transformedRooms.reduce((acc, room) => acc + room.summary.totalTasks, 0) +
                  transformedEquipment.reduce((acc, equip) => acc + equip.summary.totalTasks, 0),
      completedToday: todayCompletions + todayEquipmentCompletions,
      dueTodayRooms: transformedRooms.filter(room => room.priority === 'DUE_TODAY').length,
      overdueRooms: transformedRooms.filter(room => room.priority === 'OVERDUE').length,
      completedRooms: transformedRooms.filter(room => room.priority === 'COMPLETED').length,
      pendingRooms: transformedRooms.filter(room => 
        room.priority === 'UPCOMING' || room.priority === 'DUE_TODAY'
      ).length,
      totalActiveRooms: transformedRooms.length,
      // NEW: Equipment stats
      dueTodayEquipment: transformedEquipment.filter(equip => equip.priority === 'DUE_TODAY').length,
      overdueEquipment: transformedEquipment.filter(equip => equip.priority === 'OVERDUE').length,
      completedEquipment: transformedEquipment.filter(equip => equip.priority === 'COMPLETED').length,
      pendingEquipment: transformedEquipment.filter(equip => 
        equip.priority === 'UPCOMING' || equip.priority === 'DUE_TODAY'
      ).length,
      totalActiveEquipment: transformedEquipment.length
    }

    const roomStatus = new Map(transformedRooms.map((room) => [room.id, room]))
    const equipmentStatus = new Map(transformedEquipment.map((item) => [item.id, item]))
    const equipmentByServiceArea = new Map<string, typeof equipment>()
    equipment.forEach((item) => {
      if (!item.serviceAreaId) return
      const stored = equipmentByServiceArea.get(item.serviceAreaId) ?? []
      stored.push(item)
      equipmentByServiceArea.set(item.serviceAreaId, stored)
    })
    const publishedFloorPlans = floorPlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      floor: plan.floor,
      imageUrl: `/api/floor-plans/${plan.id}/image?v=${plan.revision}`,
      imageWidth: plan.imageWidth,
      imageHeight: plan.imageHeight,
      // A deleted room leaves an orphaned manager marker by design. Do not expose a
      // dead link to cleaners; the management editor flags it for relinking instead.
      regions: plan.regions.flatMap((region) => {
        if (!region.room) return []
        const current = roomStatus.get(region.room.id)
        const isServiceArea = region.room.type === 'SERVICE_AREA'
        const storedEquipment = isServiceArea
          ? (equipmentByServiceArea.get(region.room.id) ?? [])
          : []
        const storedWork = storedEquipment.flatMap((item) => {
          const work = equipmentStatus.get(item.id)
          return work ? [work] : []
        })
        const priority = isServiceArea
          ? combineCleanerWorkPriorities([
              current?.priority ?? 'NO_WORK',
              ...storedWork.map((item) => item.priority),
            ])
          : (current?.priority ?? 'NO_WORK')
        const totalTasks = (current?.summary.totalTasks ?? 0) +
          storedWork.reduce((total, item) => total + item.summary.totalTasks, 0)
        return [{
          id: region.id,
          label: region.label,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          kind: isServiceArea ? 'SERVICE_AREA' : 'ROOM',
          priority,
          totalTasks,
          itemCount: storedEquipment.length,
          room: {
            id: region.room.id,
            name: region.room.name,
            floor: region.room.floor || plan.floor,
            type: region.room.type,
          },
        }]
      }),
    }))

    return NextResponse.json({
      rooms: transformedRooms,
      equipment: transformedEquipment, // NEW: Include equipment in response
      stats,
      floorPlans: publishedFloorPlans,
    })

  } catch (error) {
    console.error('Error fetching cleaner dashboard data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}

// Helper functions (moved to bottom for cleaner code)
function calculateEstimatedDuration(tasks: readonly unknown[]): number {
  return tasks.length * 5
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`
}

function determineScheduleType(title: string, frequency: string): string {
  const lowerTitle = title.toLowerCase()
  
  if (lowerTitle.includes('deep') || lowerTitle.includes('thorough')) {
    return 'Deep Clean'
  } else if (lowerTitle.includes('inspection') || lowerTitle.includes('check')) {
    return 'Inspection'
  } else if (lowerTitle.includes('maintenance') || lowerTitle.includes('repair')) {
    return 'Maintenance'
  } else if (frequency === 'DAILY' || lowerTitle.includes('daily')) {
    return 'Daily Clean'
  } else if (frequency === 'WEEKLY' || lowerTitle.includes('weekly')) {
    return 'Weekly Clean'
  } else {
    return 'Standard Clean'
  }
}
