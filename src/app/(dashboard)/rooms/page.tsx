"use client"

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const roomSchema = z.object({
  name: z.string().min(1, 'Room name is required'),
  description: z.string().optional(),
  floor: z.string().optional(),
  type: z.enum(['OFFICE', 'MEETING_ROOM', 'BATHROOM', 'KITCHEN', 'LOBBY', 'STORAGE', 'BEDROOM', 'OTHER'])
})

type RoomValues = z.infer<typeof roomSchema>

interface Room extends RoomValues {
  id: string
  createdAt: string
  updatedAt: string
}

export default function RoomsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'grid' | 'form'>('grid')

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/")
    }
  }, [status, router])

  const form = useForm<RoomValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: '',
      description: '',
      floor: '',
      type: 'BEDROOM'
    }
  })

  useEffect(() => {
    if (session) {
      fetchRooms()
    }
  }, [session])

  async function fetchRooms() {
    try {
      const response = await fetch('/api/rooms')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setRooms(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rooms')
    }
  }

  async function onSubmit(data: RoomValues) {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create room')
      }

      // Add new room to list
      setRooms(prev => [result, ...prev])
      
      // Reset form
      form.reset()
      // Switch back to grid view
      setView('grid')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-teal-400 text-lg font-light">Loading...</p>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-100">Rooms</h1>
            <p className="mt-2 text-gray-400">
              Manage and monitor all rooms
            </p>
          </div>
          <Button 
            onClick={() => setView(view === 'grid' ? 'form' : 'grid')}
            className="bg-teal-500/10 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20"
          >
            {view === 'grid' ? 'Add Room' : 'View Rooms'}
          </Button>
        </div>

        {view === 'form' ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-6 rounded-lg bg-black/20 backdrop-blur-sm border border-white/5"
          >
            <h2 className="text-lg font-medium text-gray-100 mb-4">Add New Room</h2>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Room Name
                  </label>
                  <Input
                    {...form.register('name')}
                    placeholder="e.g., Room 1"
                    className="bg-white/5 border-white/10 text-gray-100"
                  />
                  {form.formState.errors.name && (
                    <p className="mt-1 text-sm text-red-400">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Floor
                  </label>
                  <Input
                    {...form.register('floor')}
                    placeholder="e.g., Ground Floor"
                    className="bg-white/5 border-white/10 text-gray-100"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Room Type
                </label>
                <select
                  {...form.register('type')}
                  className="w-full rounded-md bg-white/5 border border-white/10 text-gray-100 px-3 py-2"
                >
                  <option value="BEDROOM">Bedroom</option>
                  <option value="OFFICE">Office</option>
                  <option value="MEETING_ROOM">Meeting Room</option>
                  <option value="BATHROOM">Bathroom</option>
                  <option value="KITCHEN">Kitchen</option>
                  <option value="LOBBY">Lobby</option>
                  <option value="STORAGE">Storage</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  {...form.register('description')}
                  className="w-full rounded-md bg-white/5 border border-white/10 text-gray-100 px-3 py-2"
                  rows={3}
                  placeholder="Add any additional details about the room..."
                />
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-teal-500/10 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20"
              >
                {isLoading ? 'Adding Room...' : 'Add Room'}
              </Button>
            </form>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {rooms.map(room => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 rounded-lg bg-black/20 backdrop-blur-sm border border-white/5 hover:bg-black/30 transition-colors"
              >
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-medium text-gray-100">{room.name}</h3>
                    <span className="px-2 py-1 text-xs rounded-full bg-white/10 text-gray-300">
                      {room.type.replace('_', ' ')}
                    </span>
                  </div>
                  {room.floor && (
                    <p className="text-sm text-gray-400 mb-2">Floor: {room.floor}</p>
                  )}
                  {room.description && (
                    <p className="text-sm text-gray-400 mt-auto">{room.description}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 