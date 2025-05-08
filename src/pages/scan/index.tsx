"use client"

import type React from "react"

import type { NextPage } from "next"
import Head from "next/head"
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"
import { useState, useEffect } from "react"
import { api } from "~/utils/api"
import DashboardLayout from "~/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { useToast } from "~/components/ui/use-toast"
import { QrCode, Search, Loader2 } from "lucide-react"
import dynamic from "next/dynamic"

// Dynamically import the QR scanner component to avoid SSR issues
const QrScanner = dynamic(() => import("~/components/qr-scanner"), {
  ssr: false,
})

const ScanPage: NextPage = () => {
  const { data: sessionData, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [roomNumber, setRoomNumber] = useState("")
  const [isSearching, setIsSearching] = useState(false)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      void router.push("/api/auth/signin")
    } else if (status === "authenticated") {
      setIsLoading(false)
    }
  }, [status, router])

  // tRPC mutation for finding a room by QR code
  const findRoomByQrMutation = api.rooms.findByQrCode.useMutation({
    onSuccess: (data) => {
      if (data) {
        toast({
          title: "Room Found",
          description: `Room ${data.number} in ${data.building}`,
        })
        void router.push(`/tasks/room/${data.id}`)
      } else {
        toast({
          title: "Room Not Found",
          description: "No room found with this QR code",
          variant: "destructive",
        })
      }
      setIsScanning(false)
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
      setIsScanning(false)
    },
  })

  // tRPC mutation for finding a room by number
  const findRoomByNumberMutation = api.rooms.findByNumber.useMutation({
    onSuccess: (data) => {
      setIsSearching(false)
      if (data.length === 0) {
        toast({
          title: "Room Not Found",
          description: `No room found with number ${roomNumber}`,
          variant: "destructive",
        })
      } else if (data.length === 1) {
        toast({
          title: "Room Found",
          description: `Room ${data[0]?.number} in ${data[0]?.building}`,
        })
        void router.push(`/tasks/room/${data[0]?.id}`)
      } else {
        toast({
          title: "Multiple Rooms Found",
          description: `Found ${data.length} rooms with number ${roomNumber}`,
        })
        // Navigate to a room selection page
        void router.push({
          pathname: "/rooms",
          query: { search: roomNumber },
        })
      }
    },
    onError: (error) => {
      setIsSearching(false)
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleQrCodeScanned = (qrCode: string) => {
    findRoomByQrMutation.mutate({ qrCode })
  }

  const handleRoomNumberSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room number",
        variant: "destructive",
      })
      return
    }
    setIsSearching(true)
    findRoomByNumberMutation.mutate({ roomNumber })
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Scan Room | CleanTrack</title>
      </Head>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Scan Room</h1>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Scan QR Code</CardTitle>
                <CardDescription>Scan a room's QR code to view cleaning tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isScanning ? (
                  <div className="space-y-4">
                    <QrScanner onScan={handleQrCodeScanned} />
                    <Button variant="outline" className="w-full" onClick={() => setIsScanning(false)}>
                      Cancel Scanning
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => setIsScanning(true)}
                    disabled={findRoomByQrMutation.isLoading}
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Start QR Scanner
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Enter Room Number</CardTitle>
                <CardDescription>Manually enter a room number to view cleaning tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRoomNumberSearch} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="room-number">Room Number</Label>
                    <Input
                      id="room-number"
                      placeholder="e.g. 101"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      disabled={isSearching}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSearching}>
                    {isSearching ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Search Room
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
              <CardDescription>Learn how to use the room scanning feature</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="font-medium">QR Code Scanning</h3>
                  <p className="text-sm text-muted-foreground">
                    Each room has a unique QR code. Scan it with your device's camera to instantly access the room's
                    cleaning tasks.
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                    <li>Point your camera at the QR code</li>
                    <li>Hold steady until the code is recognized</li>
                    <li>View and complete the room's cleaning tasks</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium">Manual Room Entry</h3>
                  <p className="text-sm text-muted-foreground">
                    If you can't scan the QR code, you can manually enter the room number to access its cleaning tasks.
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                    <li>Enter the room number exactly as shown on the door</li>
                    <li>Click "Search Room" to find the room</li>
                    <li>Select the correct room if multiple matches are found</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  )
}

export default ScanPage
