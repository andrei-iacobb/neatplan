"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { Button } from "~/components/ui/button"
import { Camera, X } from "lucide-react"

interface QrScannerProps {
  onScan: (qrCode: string) => void
}

export default function QrScanner({ onScan }: QrScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Initialize scanner
    if (containerRef.current && !scannerRef.current) {
      scannerRef.current = new Html5Qrcode("qr-reader")
    }

    // Cleanup on unmount
    return () => {
      if (scannerRef.current && isScanning) {
        void scannerRef.current.stop().catch((err) => console.error("Error stopping scanner:", err))
      }
      if (scannerRef.current) {
        scannerRef.current = null
      }
    }
  }, [isScanning])

  const startScanner = async () => {
    setError(null)
    setIsScanning(true)

    if (!scannerRef.current) return

    try {
      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // On successful scan
          onScan(decodedText)
          stopScanner()
        },
        (errorMessage) => {
          // Errors that don't prevent scanning
          console.log("QR scanning in progress:", errorMessage)
        },
      )
    } catch (err) {
      setError("Failed to start camera. Please check permissions and try again.")
      setIsScanning(false)
      console.error("Error starting scanner:", err)
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop()
        setIsScanning(false)
      } catch (err) {
        console.error("Error stopping scanner:", err)
      }
    }
  }

  useEffect(() => {
    // Start scanner automatically when component mounts
    startScanner()
  }, [])

  return (
    <div className="space-y-4">
      <div
        id="qr-reader"
        ref={containerRef}
        className="w-full max-w-sm mx-auto overflow-hidden rounded-lg"
        style={{ height: "300px" }}
      ></div>

      {error && <div className="text-sm text-destructive text-center">{error}</div>}

      <div className="flex justify-center gap-2">
        {isScanning ? (
          <Button variant="outline" onClick={stopScanner}>
            <X className="mr-2 h-4 w-4" />
            Stop Scanning
          </Button>
        ) : (
          <Button onClick={startScanner}>
            <Camera className="mr-2 h-4 w-4" />
            Start Scanning
          </Button>
        )}
      </div>
    </div>
  )
}
