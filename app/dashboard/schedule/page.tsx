"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Clock, MapPin, User, CheckCircle, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { format } from "date-fns"
import { useSession } from "next-auth/react"

interface Task {
  id: number
  title: string
  description: string
  location: string
  status: string
  assigned_to_name: string
  scheduled_for: string
  created_at: string
  updated_at: string
}

export default function SchedulePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const { data: session } = useSession()

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/tasks")

      if (!response.ok) {
        throw new Error("Failed to fetch tasks")
      }

      const data = await response.json()
      setTasks(data)
    } catch (error) {
      console.error("Error fetching tasks:", error)
      toast({
        title: "Error",
        description: "Failed to load tasks. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateTaskStatus = async (taskId: number, newStatus: string) => {
    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId, status: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update task")
      }

      // Update local state
      setTasks(tasks.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task)))

      toast({
        title: "Task updated",
        description: `Task status changed to ${newStatus}.`,
        variant: "default",
      })
    } catch (error) {
      console.error("Error updating task:", error)
      toast({
        title: "Update failed",
        description: "Failed to update task status. Please try again.",
        variant: "destructive",
      })
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "No date"
    try {
      return format(new Date(dateString), "MMM d, yyyy h:mm a")
    } catch (error) {
      return "Invalid date"
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "in-progress":
        return "bg-blue-100 text-blue-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const pendingTasks = tasks.filter((task) => task.status === "pending")
  const inProgressTasks = tasks.filter((task) => task.status === "in-progress")
  const completedTasks = tasks.filter((task) => task.status === "completed")

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading tasks...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Schedule</h1>
        <Button onClick={fetchTasks}>Refresh</Button>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pendingTasks.length})</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress ({inProgressTasks.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingTasks.length > 0 ? (
            pendingTasks.map((task) => (
              <Card key={task.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle>{task.title}</CardTitle>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeClass(task.status)}`}>
                      Pending
                    </span>
                  </div>
                  <CardDescription>{task.description || "No description provided"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>{formatDate(task.scheduled_for)}</span>
                    </div>
                    {task.location && (
                      <div className="flex items-center text-sm">
                        <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{task.location}</span>
                      </div>
                    )}
                    <div className="flex items-center text-sm">
                      <User className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>{task.assigned_to_name || "Unassigned"}</span>
                    </div>

                    <div className="flex justify-end mt-4">
                      <Button
                        variant="outline"
                        className="mr-2"
                        onClick={() => updateTaskStatus(task.id, "in-progress")}
                      >
                        Start Task
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-10">
              <CheckCircle className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No pending tasks</h3>
              <p className="text-muted-foreground">All caught up! There are no pending tasks.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="in-progress" className="space-y-4">
          {inProgressTasks.length > 0 ? (
            inProgressTasks.map((task) => (
              <Card key={task.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle>{task.title}</CardTitle>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeClass(task.status)}`}>
                      In Progress
                    </span>
                  </div>
                  <CardDescription>{task.description || "No description provided"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>{formatDate(task.scheduled_for)}</span>
                    </div>
                    {task.location && (
                      <div className="flex items-center text-sm">
                        <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{task.location}</span>
                      </div>
                    )}
                    <div className="flex items-center text-sm">
                      <User className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>{task.assigned_to_name || "Unassigned"}</span>
                    </div>

                    <div className="flex justify-end mt-4">
                      <Button variant="outline" className="mr-2" onClick={() => updateTaskStatus(task.id, "pending")}>
                        Mark as Pending
                      </Button>
                      <Button onClick={() => updateTaskStatus(task.id, "completed")}>Complete Task</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-10">
              <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No tasks in progress</h3>
              <p className="text-muted-foreground">There are no tasks currently in progress.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedTasks.length > 0 ? (
            completedTasks.map((task) => (
              <Card key={task.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle>{task.title}</CardTitle>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeClass(task.status)}`}>
                      Completed
                    </span>
                  </div>
                  <CardDescription>{task.description || "No description provided"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>{formatDate(task.scheduled_for)}</span>
                    </div>
                    {task.location && (
                      <div className="flex items-center text-sm">
                        <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{task.location}</span>
                      </div>
                    )}
                    <div className="flex items-center text-sm">
                      <User className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>{task.assigned_to_name || "Unassigned"}</span>
                    </div>

                    <div className="flex justify-end mt-4">
                      <Button variant="outline" onClick={() => updateTaskStatus(task.id, "in-progress")}>
                        Reopen Task
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-10">
              <CheckCircle className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No completed tasks</h3>
              <p className="text-muted-foreground">You haven't completed any tasks yet.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
