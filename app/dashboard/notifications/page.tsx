"use client"

import React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bell, CheckCircle, Loader2, AlertTriangle } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"

interface Notification {
  id: number
  title: string
  message: string
  room_id: number
  room_number?: string
  building_name?: string
  is_read: boolean
  priority: string
  created_at: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/notifications");
      
      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }
      
      const data = await response.json();
      setNotifications(data);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast({
        title: "Error",
        description: "Failed to load notifications. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      setIsUpdating(true);
      
      const response = await fetch("/api/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, is_read: true }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to update notification");
      }
      
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => 
          notification.id === id ? { ...notification, is_read: true } : notification
        )
      );
      
    } catch (error) {
      console.error("Error updating notification:", error);
      toast({
        title: "Error",
        description: "Failed to mark notification as read. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      setIsUpdating(true);
      
      const unreadIds = notifications
        .filter(notification => !notification.is_read)
        .map(notification => notification.id);
      
      if (unreadIds.length === 0) {
        toast({
          title: "No unread notifications",
          description: "You don't have any unread notifications.",
        });
        setIsUpdating(false);
        return;
      }
      
      for (const id of unreadIds) {
        await fetch("/api/notifications", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id, is_read: true }),
        });
      }
      
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => ({ ...notification, is_read: true }))
      );
      
      toast({
        title: "Success",
        description: `Marked ${unreadIds.length} notifications as read.`,
      });
      
    } catch (error) {
      console.error("Error updating notifications:", error);
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    return format(new Date(dateString), "MMM d, yyyy h:mm a");
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Urgent
          </span>
        );
      case "normal":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Bell className="w-3 h-3 mr-1" />
            Normal
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Low
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {priority}
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading notifications...</span>
      </div>
    );
  }

  const unreadNotifications = notifications.filter(notification => !notification.is_read);
  const readNotifications = notifications.filter(notification => notification.is_read);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchNotifications}>
            Refresh
          </Button>
          <Button onClick={markAllAsRead} disabled={isUpdating || unreadNotifications.length === 0}>
            Mark All as Read
          </Button>
        </div>
      </div>

      <Tabs defaultValue="unread">
        <TabsList>
          <TabsTrigger value="unread">
            Unread ({unreadNotifications.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({notifications.length})
          </TabsTrigger>
          <TabsTrigger value="read">
            Read ({readNotifications.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="unread" className="space-y-4">
          {unreadNotifications.length > 0 ? (
            unreadNotifications.map((notification) => (
              <Card key={notification.id} className={notification.priority === "high" ? "border-red-300" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{notification.title}</CardTitle>
                    {getPriorityBadge(notification.priority)}
                  </div>
                  <CardDescription>
                    {formatDate(notification.created_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p>{notification.message}</p>
                  
                  <div className="flex justify-between items-center pt-2">
                    <div>
                      {notification.room_id && (
                        <Link href={`/dashboard/rooms/${notification.room_id}`}>
                          <Button variant="outline" size="sm">
                            View Room
                          </Button>
                        </Link>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => markAsRead(notification.id)}
                      disabled={isUpdating}
                    >
                      Mark as Read
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No unread notifications
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <Card key={notification.id} className={notification.priority === "high" ? "border-red-300" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{notification.title}</CardTitle>
                    {getPriorityBadge(notification.priority)}
                  </div>
                  <CardDescription>
                    {formatDate(notification.created_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p>{notification.message}</p>
                  
                  <div className="flex justify-between items-center pt-2">
                    <div>
                      {notification.room_id && (
                        <Link href={`/dashboard/rooms/${notification.room_id}`}>
                          <Button variant="outline" size="sm">
                            View Room
                          </Button>
                        </Link>
                      )}
                    </div>
                    {!notification.is_read && (
                      <Button 
                        size="sm" 
                        onClick={() => markAsRead(notification.id)}
                        disabled={isUpdating}
                      >
                        Mark as Read
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No notifications
            </div>
          )}
        </TabsContent>

        <TabsContent value="read" className="space-y-4">
          {readNotifications.length > 0 ? (
            readNotifications.map((notification) => (
              <Card key={notification.id}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{notification.title}</CardTitle>
                    {getPriorityBadge(notification.priority)}
                  </div>
                  <CardDescription>
                    {formatDate(notification.created_at)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p>{notification.message}</p>
                  
                  <div className="flex justify-between items-center pt-2">
                    <div>
                      {notification.room_id && (
                        <Link href={`/dashboard/rooms/${notification.room_id}`}>
                          <Button variant="outline" size="sm">
                            View Room
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No read notifications
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
