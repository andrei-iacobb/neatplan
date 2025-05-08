"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Home, CheckSquare, AlertTriangle, Loader2, ClipboardList, Clock, QrCode } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { format } from "date-fns"
import { useSession } from "next-auth/react"
import Link from "next/link"

interface DashboardStats {
  roomStats?: {
    total_rooms: number
    clean_rooms: number
    dirty_rooms: number
    maintenance_rooms: number
  }
  taskStats: {
    total_tasks: number
    pending_tasks: number
    in_progress_tasks: number
    completed_tasks: number
    unassigned_tasks?: number
  }
  cleanerStats?: {
    total_cleaners: number
  }
  notificationStats?: {
    unread_notifications: number
  }
  recentTasks?: Array<{
    id: number
    name: string
    status: string
    scheduled_for: string
    room_number: string
    assigned_to_name: string
  }>
  cleanerPerformance?: Array<{
    id: number
    username: string
    completed_tasks: number
    pending_tasks: number
    completion_rate: number
  }>
  urgentTasks?: Array<{
    id: number
    name: string
    priority: number
    room_number: string
    building_name: string
  }>
  todaySchedule?: Array<{
    id: number
    name: string
    status: string
    room_number: string
    building_name: string
  }>
  completionStats?: {
    total_assigned: number
    completed: number
    completion_rate: number
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const { data: session } = useSession()

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)

      const response = await fetch("/api/dashboard/stats")

      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data")
      }

      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      toast({
        title: "Error",
        description: "Failed to load dashboard data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return ""
    return format(new Date(dateString), "MMM d, yyyy h:mm a")
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-500 bg-green-100"
      case "in-progress":
        return "text-blue-500 bg-blue-100"
      case "pending":
        return "text-yellow-500 bg-yellow-100"
      default:
        return "text-gray-500 bg-gray-100"
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading dashboard data...</span>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Data Available</h2>
        <p className="text-muted-foreground mb-4">Unable to load dashboard data.</p>
        <Button onClick={fetchDashboardData}>Try Again</Button>
      </div>
    )
  }

  const isAdminUser = session?.user?.role === "admin"

  // Admin Dashboard
  if (isAdminUser) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <Button onClick={fetchDashboardData}>Refresh</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.roomStats?.total_rooms || 0}</div>
              <p className="text-xs text-muted-foreground">Rooms in the system</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Dirty Rooms</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.roomStats?.dirty_rooms || 0}</div>
              <p className="text-xs text-muted-foreground">Rooms needing cleaning</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.taskStats?.pending_tasks || 0}</div>
              <p className="text-xs text-muted-foreground">Tasks waiting to be completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Staff</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.cleanerStats?.total_cleaners || 0}</div>
              <p className="text-xs text-muted-foreground">Active cleaning staff</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="staff">
          <TabsList>
            <TabsTrigger value="staff">Staff Performance</TabsTrigger>
            <TabsTrigger value="tasks">Recent Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="staff" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Staff Performance</CardTitle>
                <CardDescription>Cleaning staff task completion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.cleanerPerformance && stats.cleanerPerformance.length > 0 ? (
                    stats.cleanerPerformance.map((staff) => (
                      <div key={staff.id} className="flex items-center justify-between border-b pb-4">
                        <div>
                          <p className="font-medium">{staff.username}</p>
                          <p className="text-sm text-muted-foreground">
                            {staff.completed_tasks} completed / {staff.pending_tasks} pending
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2.5">
                            <div
                              className="bg-primary h-2.5 rounded-full"
                              style={{ width: `${staff.completion_rate || 0}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{staff.completion_rate || 0}%</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">No staff performance data available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Tasks</CardTitle>
                <CardDescription>Recently created or updated tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.recentTasks && stats.recentTasks.length > 0 ? (
                    stats.recentTasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between border-b pb-4">
                        <div>
                          <p className="font-medium">{task.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Room {task.room_number} | Assigned to: {task.assigned_to_name || "Unassigned"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm px-2 py-1 rounded-full ${getStatusBadgeClass(task.status)}`}>
                            {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                          </span>
                          <p className="text-sm text-muted-foreground">{formatDate(task.scheduled_for)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">No recent tasks found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  // Cleaner Dashboard
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Cleaner Dashboard</h1>
        <Button onClick={fetchDashboardData}>Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.taskStats?.pending_tasks || 0}</div>
            <p className="text-xs text-muted-foreground">Tasks waiting to be completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.taskStats?.completed_tasks || 0}</div>
            <p className="text-xs text-muted-foreground">Tasks completed successfully</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionStats?.completion_rate || 0}%</div>
            <p className="text-xs text-muted-foreground">Your task completion rate</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Urgent Tasks</CardTitle>
            <CardDescription>Tasks that need immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.urgentTasks && stats.urgentTasks.length > 0 ? (
              <div className="space-y-4">
                {stats.urgentTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between border-b pb-4">
                    <div>
                      <p className="font-medium">{task.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {task.building_name} - Room {task.room_number}
                      </p>
                    </div>
                    <Link href={`/dashboard/rooms/${task.id}`}>
                      <Button size="sm">View</Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckSquare className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p>No urgent tasks at the moment</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks you might want to perform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/dashboard/scan">
              <Button className="w-full flex items-center justify-center gap-2">
                <QrCode className="h-4 w-4" />
                Scan Room QR Code
              </Button>
            </Link>

            <Link href="/dashboard/rooms">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                <ClipboardList className="h-4 w-4" />
                View All Assigned Rooms
              </Button>
            </Link>

            <Link href="/dashboard/notifications">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Check Notifications
                {stats.notificationStats && stats.notificationStats.unread_notifications > 0 && (
                  <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                    {stats.notificationStats.unread_notifications}
                  </span>
                )}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Schedule</CardTitle>
          <CardDescription>Tasks scheduled for today</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.todaySchedule && stats.todaySchedule.length > 0 ? (
            <div className="space-y-4">
              {stats.todaySchedule.map((task) => (
                <div key={task.id} className="flex items-center justify-between border-b pb-4">
                  <div>
                    <p className="font-medium">{task.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.building_name} - Room {task.room_number}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm px-2 py-1 rounded-full ${getStatusBadgeClass(task.status)}`}>
                      {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                    </span>
                    <Link href={`/dashboard/rooms/${task.id}`}>
                      <Button size="sm" variant="outline">
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p>No tasks scheduled for today</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
