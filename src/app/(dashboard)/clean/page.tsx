"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2, ArrowRight, Clock, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/toast-context'

interface Room {
  id: string
  name: string
  type: string
  floor?: string
  schedules: {
    id: string
    title: string
    frequency: string
    nextDue: string
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'
  }[]
}

export default function CleanerDashboardPage() {
  const { showToast } = useToast()
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchRooms() {
      try {
        const [roomsResponse, schedulesPromises] = await Promise.all([
          fetch('/api/rooms'),
          fetch('/api/rooms/schedules')
        ])

        if (!roomsResponse.ok) {
          throw new Error('Failed to fetch rooms')
        }

        const roomsData = await roomsResponse.json()
        const schedulesData = await schedulesPromises.json()

        // Combine room data with their schedules
        const roomsWithSchedules = roomsData.map((room: any) => ({
          ...room,
          schedules: schedulesData.filter((schedule: any) => schedule.roomId === room.id)
        }))

        // Filter out rooms with no pending or overdue schedules
        const activeRooms = roomsWithSchedules.filter((room: Room) =>
          room.schedules.some(schedule => 
            schedule.status === 'PENDING' || 
            schedule.status === 'OVERDUE' ||
            schedule.status === 'IN_PROGRESS'
          )
        )

        // Sort rooms by priority (overdue first, then pending)
        const sortedRooms = activeRooms.sort((a: Room, b: Room) => {
          const aHasOverdue = a.schedules.some(s => s.status === 'OVERDUE')
          const bHasOverdue = b.schedules.some(s => s.status === 'OVERDUE')
          
          if (aHasOverdue && !bHasOverdue) return -1
          if (!aHasOverdue && bHasOverdue) return 1
          
          // If both have same status, sort by next due date
          const aNextDue = Math.min(...a.schedules.map(s => new Date(s.nextDue).getTime()))
          const bNextDue = Math.min(...b.schedules.map(s => new Date(s.nextDue).getTime()))
          return aNextDue - bNextDue
        })

        setRooms(sortedRooms)
      } catch (error) {
        console.error('Error fetching rooms:', error)
        showToast('Failed to load rooms', 'error')
      } finally {
        setIsLoading(false)
      }
    }

    fetchRooms()
  }, [showToast])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-100">Cleaning Tasks</h1>
        <p className="text-gray-400 mt-1">
          Rooms that need attention, sorted by priority
        </p>
      </div>

      <div className="space-y-4">
        {rooms.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No rooms need cleaning at the moment.</p>
          </div>
        ) : (
          rooms.map(room => (
            <Link
              key={room.id}
              href={`/clean/${room.id}`}
              className="block bg-gray-800/50 hover:bg-gray-800/70 rounded-lg border border-gray-700 p-6 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-medium text-gray-100">
                    {room.name}
                  </h2>
                  <p className="text-gray-400 mt-1">
                    {room.type.replace('_', ' ')} • {room.floor}
                  </p>
                  
                  <div className="mt-4 space-y-2">
                    {room.schedules
                      .filter(schedule => 
                        schedule.status === 'PENDING' || 
                        schedule.status === 'OVERDUE' ||
                        schedule.status === 'IN_PROGRESS'
                      )
                      .map(schedule => (
                        <div
                          key={schedule.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          {schedule.status === 'OVERDUE' ? (
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                          ) : (
                            <Clock className="w-4 h-4 text-yellow-400" />
                          )}
                          <span className="text-gray-300">{schedule.title}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-400">{schedule.frequency}</span>
                          <span className="text-gray-500">•</span>
                          <span
                            className={`${
                              schedule.status === 'OVERDUE'
                                ? 'text-red-400'
                                : 'text-yellow-400'
                            }`}
                          >
                            {schedule.status === 'OVERDUE' ? 'Overdue' : 'Due'} {new Date(schedule.nextDue).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
} 