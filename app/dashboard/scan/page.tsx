"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { QrCode, Search, Loader2 } from "lucide-react"
import { Html5QrcodeScanner } from "html5-qrcode"

export default function ScanPage() {
  const [roomNumber, setRoomNumber] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const scannerDivRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    // Clean up scanner on component unmount
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear()
      }
    }
  }, [])

  const startScanner = () => {
    if (!scannerDivRef.current) return

    setIsScanning(true)

    // Clear previous scanner instance
    if (scannerRef.current) {
      scannerRef.current.clear()
    }

    // Create new scanner
    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
      },
      false,
    )

    // Start scanner with callbacks
    scannerRef.current.render(
      (decodedText) => {
        handleQrCodeSuccess(decodedText)
      },
      (errorMessage) => {
        console.error("QR Code scanning error:", errorMessage)
      },
    )
  }

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear()
    }
    setIsScanning(false)
  }

  const handleQrCodeSuccess = async (qrCodeId: string) => {
    // Stop scanner after successful scan
    stopScanner()

    setIsLoading(true)

    try {
      // Fetch room data using QR code ID
      const response = await fetch(`/api/rooms/qr/${qrCodeId}`)

      if (!response.ok) {
        throw new Error("Room not found")
      }

      const roomData = await response.json()

      toast({
        title: "Room Found",
        description: `Room ${roomData.room_number} in ${roomData.building_name}`,
      })

      // Navigate to room details page
      router.push(`/dashboard/rooms/${roomData.id}`)
    } catch (error) {
      console.error("Error fetching room:", error)
      toast({
        title: "Error",
        description: "Could not find room with this QR code. Please try again.",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  const handleRoomNumberSearch = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!roomNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a room number",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Fetch rooms with this room number
      const response = await fetch(`/api/rooms?room_number=${roomNumber}`)

      if (!response.ok) {
        throw new Error("Failed to search for room")
      }

      const rooms = await response.json()

      if (rooms.length === 0) {
        toast({
          title: "Room Not Found",
          description: `No room found with number ${roomNumber}`,
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      if (rooms.length === 1) {
        // If only one room found, navigate directly to it
        toast({
          title: "Room Found",
          description: `Room ${rooms[0].room_number} in ${rooms[0].building_name}`,
        })
        router.push(`/dashboard/rooms/${rooms[0].id}`)
      } else {
        // If multiple rooms found (e.g., same room number in different buildings)
        // Navigate to rooms list with filter
        toast({
          title: "Multiple Rooms Found",
          description: `Found ${rooms.length} rooms with number ${roomNumber}`,
        })
        router.push(`/dashboard/rooms?room_number=${roomNumber}`)
      }
    } catch (error) {
      console.error("Error searching for room:", error)
      toast({
        title: "Error",
        description: "Failed to search for room. Please try again.",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  return (
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
                <div id="qr-reader" ref={scannerDivRef} className="w-full max-w-sm mx-auto"></div>
                <Button variant="outline" className="w-full" onClick={stopScanner}>
                  Cancel Scanning
                </Button>
              </div>
            ) : (
              <Button className="w-full" onClick={startScanner} disabled={isLoading}>
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
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
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
  )
}
