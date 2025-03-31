"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Home, CheckSquare, AlertTriangle, Plus, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { format } from "date-fns"
import { useSession } from "next-auth/react"

interface Task {
  id: number
  title: string
  status: string
  assigned_to_name: string
  created_at: string
  updated_at: string
  scheduled_for: string
}

interface Issue {
  id: number
  task_title: string
  description: string
  severity: string
  reported_by_name: string
  created_at: string
}

interface DashboardStats {
  activeHousekeepers: number
  taskStats: {
    pending_tasks: number
    in_progress_tasks: number
    completed_tasks: number
    unassigned_tasks: number
  }
  recentDocuments: Array<{
    id: number
    file_path: string
    status: string
    uploaded_by_name: string
    created_at: string
    task_count: number
  }>
  housekeeperPerformance: Array<{
    id: number
    name: string
    completed_tasks: number
    pending_tasks: number
    completion_rate: number
  }>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === "authenticated") {
      fetchDashboardData()
    }
  }, [status])

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
      case "scheduled":
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        {isAdminUser && (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isAdminUser && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeHousekeepers}</div>
              <p className="text-xs text-muted-foreground">Active housekeeping staff</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.taskStats.pending_tasks}</div>
            <p className="text-xs text-muted-foreground">Tasks waiting to be started</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.taskStats.in_progress_tasks}</div>
            <p className="text-xs text-muted-foreground">Tasks currently in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.taskStats.completed_tasks}</div>
            <p className="text-xs text-muted-foreground">Tasks completed successfully</p>
          </CardContent>
        </Card>

        {isAdminUser && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Unassigned Tasks</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.taskStats.unassigned_tasks}</div>
              <p className="text-xs text-muted-foreground">Tasks not assigned to any staff</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="performance">
        <TabsList>
          {isAdminUser && <TabsTrigger value="performance">Staff Performance</TabsTrigger>}
          <TabsTrigger value="documents">Recent Documents</TabsTrigger>
        </TabsList>

        {isAdminUser && (
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Staff Performance</CardTitle>
                <CardDescription>Housekeeping staff task completion rates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.housekeeperPerformance && stats.housekeeperPerformance.length > 0 ? (
                    stats.housekeeperPerformance.map((staff) => (
                      <div key={staff.id} className="flex items-center justify-between border-b pb-4">
                        <div>
                          <p className="font-medium">{staff.name}</p>
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
        )}

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Documents</CardTitle>
              <CardDescription>Recently uploaded and processed documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recentDocuments && stats.recentDocuments.length > 0 ? (
                  stats.recentDocuments.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between border-b pb-4">
                      <div>
                        <p className="font-medium">Document #{doc.id}</p>
                        <p className="text-sm text-muted-foreground">Uploaded by: {doc.uploaded_by_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm px-2 py-1 rounded-full ${getStatusBadgeClass(doc.status)}`}>
                          {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                        </span>
                        <div className="flex flex-col items-end">
                          <span className="text-sm">{doc.task_count} tasks</span>
                          <span className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">No documents found</p>
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

