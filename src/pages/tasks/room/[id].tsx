"use client"

import type { NextPage } from "next"
import Head from "next/head"
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { api } from "~/utils/api"
import DashboardLayout from "~/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import { useToast } from "~/components/ui/use-toast"
import { ArrowLeft, Building, MapPin, CheckCircle, Loader2, AlertTriangle } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"

const RoomTasksPage: NextPage = () => {
  const { data: sessionData, status } = useSession()
  const router = useRouter()
  const { id } = router.query
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      void router.push("/api/auth/signin")
    } else if (status === "authenticated" && id) {
      setIsLoading(false)
    }
  }, [status, router, id])

  // Fetch room data with tasks
  const {
    data: roomData,
    isLoading: isRoomLoading,
    error: roomError,
  } = api.rooms.getRoomWithTasks.useQuery(
    { id: id as string },
    {
      enabled: !!id && status === "authenticated",
      onSuccess: (data) => {
        // Initialize completed tasks state
        if (data?.tasks) {
          const initialState: Record<string, boolean> = {}
          data.tasks.forEach((task) => {
            initialState[task.id] = task.status === "completed"
          })
          setCompletedTasks(initialState)
        }
      },
    },
  )

  // tRPC mutation for completing tasks
  const completeTasksMutation = api.tasks.completeTasks.useMutation({
    onSuccess: () => {
      setIsSubmitting(false)
      toast({
        title: "Tasks completed",
        description: "All tasks have been marked as completed.",
      })

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        void router.push("/dashboard")
      }, 1000)
    },
    onError: (error) => {
      setIsSubmitting(false)
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleTaskToggle = (taskId: string) => {
    setCompletedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }))
  }

  const handleSubmit = () => {
    if (!roomData) return

    const completedTaskIds = Object.entries(completedTasks)
      .filter(([_, isCompleted]) => isCompleted)
      .map(([id]) => id)

    if (completedTaskIds.length === 0) {
      toast({
        title: "No tasks completed",
        description: "Please complete at least one task before submitting.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    completeTasksMutation.mutate({
      roomId: roomData.id,
      taskIds: completedTaskIds,
    })
  }

  if (isLoading || isRoomLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (roomError || !roomData) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Room Not Found</h2>
          <p className="text-muted-foreground mb-4">Unable to load room data.</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <>
      <Head>
        <title>Room Tasks | CleanTrack</title>
      </Head>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-3xl font-bold">Room {roomData.number}</h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  roomData.status === "clean" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {roomData.status === "clean" ? "Clean" : "Needs Cleaning"}
              </span>
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
                    <span>{roomData.building}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Floor:</span>
                    <span>{roomData.floor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Room Type:</span>
                    <span>{roomData.type}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Status:</span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        roomData.status === "clean" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {roomData.status === "clean" ? "Clean" : "Needs Cleaning"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Last Cleaned:</span>
                    <span>
                      {roomData.lastCleaned
                        ? `${formatDistanceToNow(new Date(roomData.lastCleaned))} ago`
                        : "Not available"}
                    </span>
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
                {roomData.tasks && roomData.tasks.length > 0 ? (
                  roomData.tasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-3 border-b pb-4">
                      <Checkbox
                        id={`task-${task.id}`}
                        checked={completedTasks[task.id] || false}
                        onCheckedChange={() => handleTaskToggle(task.id)}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor={`task-${task.id}`}
                          className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                            completedTasks[task.id] ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {task.name}
                        </label>
                        <p className="text-sm text-muted-foreground">{task.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">Priority: {task.priority}</span>
                          <span className="text-xs text-muted-foreground">
                            Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p>No tasks assigned to this room</p>
                  </div>
                )}

                {roomData.tasks && roomData.tasks.length > 0 && (
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting || Object.values(completedTasks).every((v) => !v)}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Complete Tasks
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  )
}

export default RoomTasksPage
