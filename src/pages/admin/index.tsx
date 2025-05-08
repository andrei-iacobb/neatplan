"use client"

import type { NextPage } from "next"
import Head from "next/head"
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { api } from "~/utils/api"
import AdminLayout from "~/components/layouts/admin-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { useToast } from "~/components/ui/use-toast"
import { Users, Home, AlertTriangle, Loader2, ClipboardList, BarChart } from "lucide-react"
import { format } from "date-fns"

const AdminDashboard: NextPage = () => {
  const { data: sessionData, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (status === "unauthenticated") {
      void router.push("/api/auth/signin")
    } else if (status === "authenticated") {
      if (sessionData?.user?.role !== "admin") {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access the admin dashboard.",
          variant: "destructive",
        })
        void router.push("/dashboard")
      } else {
        setIsLoading(false)
      }
    }
  }, [status, router, sessionData, toast])

  // Fetch admin dashboard stats
  const { data: statsData, isLoading: isStatsLoading } = api.admin.getDashboardStats.useQuery(undefined, {
    enabled: status === "authenticated" && sessionData?.user?.role === "admin",
  })

  if (isLoading || isStatsLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Admin Dashboard | CleanTrack</title>
      </Head>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <Button variant="outline">Refresh</Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
                <Home className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsData?.roomStats.total || 0}</div>
                <p className="text-xs text-muted-foreground">Rooms in the system</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Rooms Needing Cleaning</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsData?.roomStats.needsCleaning || 0}</div>
                <p className="text-xs text-muted-foreground">Rooms that need attention</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsData?.taskStats.pending || 0}</div>
                <p className="text-xs text-muted-foreground">Tasks waiting to be completed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Staff</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statsData?.userStats.total || 0}</div>
                <p className="text-xs text-muted-foreground">Active cleaning staff</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="staff">
            <TabsList>
              <TabsTrigger value="staff">Staff Performance</TabsTrigger>
              <TabsTrigger value="tasks">Recent Tasks</TabsTrigger>
              <TabsTrigger value="documents">Processed Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="staff" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Staff Performance</CardTitle>
                  <CardDescription>Cleaning staff task completion rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {statsData?.staffPerformance && statsData.staffPerformance.length > 0 ? (
                      statsData.staffPerformance.map((staff) => (
                        <div key={staff.id} className="flex items-center justify-between border-b pb-4">
                          <div>
                            <p className="font-medium">{staff.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {staff.completedTasks} completed / {staff.pendingTasks} pending
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-32 bg-gray-200 rounded-full h-2.5">
                              <div
                                className="bg-teal-600 h-2.5 rounded-full"
                                style={{ width: `${staff.completionRate || 0}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium">{staff.completionRate || 0}%</span>
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

            <TabsContent value="tasks" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Tasks</CardTitle>
                  <CardDescription>Recently completed or updated tasks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {statsData?.recentTasks && statsData.recentTasks.length > 0 ? (
                      statsData.recentTasks.map((task) => (
                        <div key={task.id} className="flex items-center justify-between border-b pb-4">
                          <div>
                            <p className="font-medium">{task.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Room {task.roomNumber} | Completed by: {task.completedBy || "Unassigned"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm px-2.5 py-0.5 rounded-full ${
                                task.status === "completed"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                            </span>
                            <p className="text-sm text-muted-foreground">
                              {task.completedAt ? format(new Date(task.completedAt), "MMM d, yyyy") : "Not completed"}
                            </p>
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

            <TabsContent value="documents" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Processed Documents</CardTitle>
                  <CardDescription>Recently processed cleaning sheets</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {statsData?.recentDocuments && statsData.recentDocuments.length > 0 ? (
                      statsData.recentDocuments.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between border-b pb-4">
                          <div>
                            <p className="font-medium">{doc.filename}</p>
                            <p className="text-sm text-muted-foreground">
                              Uploaded by: {doc.uploadedBy} | {format(new Date(doc.processedAt), "MMM d, yyyy")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{doc.tasksCreated} tasks created</span>
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-muted-foreground">No processed documents found</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>System Overview</CardTitle>
                <CardDescription>Key metrics for the cleaning management system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Completion Rate</p>
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-teal-600 h-2.5 rounded-full"
                            style={{ width: `${statsData?.systemStats.completionRate || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">{statsData?.systemStats.completionRate || 0}%</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Average Cleaning Time</p>
                      <p className="text-2xl font-bold">{statsData?.systemStats.avgCleaningTime || 0} min</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-medium">Buildings</p>
                      <span className="text-sm text-muted-foreground">{statsData?.systemStats.buildings || 0}</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-medium">Total Tasks Created</p>
                      <span className="text-sm text-muted-foreground">{statsData?.systemStats.totalTasks || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium">Documents Processed</p>
                      <span className="text-sm text-muted-foreground">
                        {statsData?.systemStats.documentsProcessed || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common administrative tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full flex items-center justify-center gap-2">
                  <Users className="h-4 w-4" />
                  Manage Staff
                </Button>

                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <Home className="h-4 w-4" />
                  Manage Rooms
                </Button>

                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <BarChart className="h-4 w-4" />
                  Generate Reports
                </Button>

                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  View All Tasks
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </AdminLayout>
    </>
  )
}

export default AdminDashboard
