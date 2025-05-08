"use client"

import React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Building2, Clock, CheckCircle2, AlertTriangle, Loader2, Plus, Filter } from "lucide-react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Room {
  id: string
  name: string
  building: string
  floor: string
  status: "clean" | "needs_cleaning" | "in_progress" | "maintenance"
  lastCleaned?: string
  tasks: {
    id: string
    title: string
    priority: string
  }[]
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({
    building: "all",
    floor: "all",
    status: "all"
  })
  const { toast } = useToast()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "admin"

  useEffect(() => {
    fetchRooms()
  }, [filters])

  const fetchRooms = async () => {
    try {
      setIsLoading(true)
      const queryParams = new URLSearchParams()
      if (filters.building !== "all") queryParams.append("building", filters.building)
      if (filters.floor !== "all") queryParams.append("floor", filters.floor)
      if (filters.status !== "all") queryParams.append("status", filters.status)

      const response = await fetch(`/api/rooms?${queryParams.toString()}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch rooms")
      }
      
      const data = await response.json()
      setRooms(data)
    } catch (error) {
      console.error("Error fetching rooms:", error)
      toast({
        title: "Error",
        description: "Failed to load rooms. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "clean":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Clean
          </span>
        )
      case "needs_cleaning":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Needs Cleaning
          </span>
        )
      case "in_progress":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            In Progress
          </span>
        )
      case "maintenance":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Building2 className="w-3 h-3 mr-1" />
            Maintenance
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        )
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800"
      case "normal":
        return "bg-blue-100 text-blue-800"
      case "low":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading rooms...</span>
      </div>
    )
  }

  // Get unique buildings and floors for filters
  const buildings = Array.from(new Set(rooms.map(room => room.building)))
  const floors = Array.from(new Set(rooms.map(room => room.floor)))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Rooms</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRooms}>
            Refresh
          </Button>
          {isAdmin && (
            <Link href="/dashboard/rooms/register">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Register Room
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filters:</span>
        </div>
        <Select
          value={filters.building}
          onValueChange={(value) => setFilters(prev => ({ ...prev, building: value }))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Building" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Buildings</SelectItem>
            {buildings.map(building => (
              <SelectItem key={building} value={building}>
                {building}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.floor}
          onValueChange={(value) => setFilters(prev => ({ ...prev, floor: value }))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Floor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Floors</SelectItem>
            {floors.map(floor => (
              <SelectItem key={floor} value={floor}>
                {floor}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="clean">Clean</SelectItem>
            <SelectItem value="needs_cleaning">Needs Cleaning</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <Card key={room.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle>{room.name}</CardTitle>
                {getStatusBadge(room.status)}
              </div>
              <CardDescription>
                {room.building} • {room.floor}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {room.lastCleaned && (
                    <span>Last cleaned: {new Date(room.lastCleaned).toLocaleDateString()}</span>
                  )}
                </div>

                {room.tasks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Pending Tasks:</h4>
                    <div className="space-y-1">
                      {room.tasks.map(task => (
                        <div
                          key={task.id}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityBadge(task.priority)}`}
                        >
                          {task.title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Link href={`/dashboard/rooms/${room.id}`}>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
} 