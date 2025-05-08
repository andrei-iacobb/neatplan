"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { CheckCircle, Clock, AlertTriangle, Loader2, ArrowLeft, Building, MapPin, Edit, Trash2 } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"

interface Room {
  id: number
  building_id: number
  room_number: string
  floor: string
  room_type: string
  status: string
  last_cleaned: string
  building_name: string
  tasks: Task[]
  cleaning_sheets: {
    id: number
    created_at: string
  }[]
}

interface Task {
  id: number
  room_id: number
  template_id: number
  name: string
  description: string
  status: string
  priority: number
  assigned_to: number
  scheduled_for: string
  completed_at: string
  completed_by: number
  template_name: string
  assigned_to_name: string
}

export default function RoomDetailPage({ params }: { params: { id: string } }) {
  const [room, setRoom] = useState<Room | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    fetchRoomData()
  }, [params.id])

  const fetchRoomData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/rooms/${params.id}`)

      if (!response.ok) {
        throw new Error("Failed to fetch room data")
      }

      const data = await response.json()
      setRoom(data)
    } catch (error) {
      console.error("Error fetching room data:", error)
      toast({
        title: "Error",
        description: "Failed to load room data. Please try again.",
        variant: "destructive",
      })
      router.push("/dashboard/rooms")
    } finally {
      setIsLoading(false)
    }
  }

  const updateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      setIsUpdating(true)

      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update task")
      }

      // Update local state
      setRoom((prevRoom) => {
        if (!prevRoom) return null

        return {
          ...prevRoom,
          tasks: prevRoom.tasks.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task)),
        }
      })

      toast({
        title: "Task Updated",
        description: `Task status changed to ${newStatus}.`,
      })

      // If all tasks are completed, update room status
      if (newStatus === "completed") {
        const allTasksCompleted = room?.tasks.every((task) => (task.id === taskId ? true : task.status === "completed"))

        if (allTasksCompleted) {
          updateRoomStatus("clean")
        }
      }
    } catch (error) {
      console.error("Error updating task:", error)
      toast({
        title: "Error",
        description: "Failed to update task status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const updateRoomStatus = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/rooms/${params.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update room status")
      }

      // Update local state
      setRoom((prevRoom) => {
        if (!prevRoom) return null
        return { ...prevRoom, status: newStatus }
      })

      toast({
        title: "Room Updated",
        description: `Room status changed to ${newStatus}.`,
      })
    } catch (error) {
      console.error("Error updating room status:", error)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this room? This will also delete all associated cleaning sheets.")) {
      return
    }

    try {
      setIsDeleting(true)
      const response = await fetch(`/api/rooms/${params.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete room")
      }

      toast({
        title: "Success",
        description: "Room deleted successfully",
      })

      router.push("/dashboard/rooms")
    } catch (error) {
      console.error("Error deleting room:", error)
      toast({
        title: "Error",
        description: "Failed to delete room. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "Not available"
    try {
      return format(new Date(dateString), "MMM d, yyyy h:mm a")
    } catch (error) {
      return "Invalid date"
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "clean":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Clean
          </span>
        )
      case "dirty":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Needs Cleaning
          </span>
        )
      case "maintenance":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
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

  const getTaskStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </span>
        )
      case "in-progress":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1" />
            In Progress
          </span>
        )
      case "pending":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading room data...</span>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Room Not Found</h2>
        <p className="text-muted-foreground mb-4">Unable to load room data.</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/dashboard/rooms")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Room {room.room_number}</h1>
          {getStatusBadge(room.status)}
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/rooms/${params.id}/edit`}>
            <Button variant="outline">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </>
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Room Details</CardTitle>
          <CardDescription>Information about this room</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Building:</span>
                <span>{room.building_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Floor:</span>
                <span>{room.floor}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Room Type:</span>
                <span>{room.room_type}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                {getStatusBadge(room.status)}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Last Cleaned:</span>
                <span>{formatDate(room.last_cleaned)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cleaning Tasks</CardTitle>
          <CardDescription>Tasks that need to be completed for this room</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {room.tasks.length > 0 ? (
              room.tasks.map((task) => (
                <div key={task.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{task.name}</h3>
                      <p className="text-sm text-muted-foreground">{task.description}</p>
                    </div>
                    {getTaskStatusBadge(task.status)}
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <div>
                      <span className="text-muted-foreground">Priority: </span>
                      <span className="font-medium">{task.priority}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Scheduled: </span>
                      <span>{formatDate(task.scheduled_for)}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    {task.status === "pending" && (
                      <Button size="sm" onClick={() => updateTaskStatus(task.id, "in-progress")} disabled={isUpdating}>
                        Start Task
                      </Button>
                    )}

                    {task.status === "in-progress" && (
                      <Button size="sm" onClick={() => updateTaskStatus(task.id, "completed")} disabled={isUpdating}>
                        Complete Task
                      </Button>
                    )}

                    {task.status === "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateTaskStatus(task.id, "pending")}
                        disabled={isUpdating}
                      >
                        Reopen Task
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p>No tasks assigned to this room</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Cleaning Sheets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {room.cleaning_sheets.length > 0 ? (
            room.cleaning_sheets.map((sheet) => (
              <div key={sheet.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Cleaning Sheet #{sheet.id}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(sheet.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Link href={`/dashboard/cleaning-sheets/${sheet.id}`}>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </Link>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">No cleaning sheets yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
