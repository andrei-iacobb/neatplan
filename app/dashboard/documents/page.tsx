"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, FileText, Check, AlertCircle, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useSession } from "next-auth/react"

export default function DocumentsPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { data: session } = useSession()

  // Check if user is admin
  const isAdmin = session?.user?.role === "admin"

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]

      // Check file type
      if (!file.type.includes("image/") && !file.type.includes("application/pdf")) {
        toast({
          title: "Invalid file type",
          description: "Please upload an image or PDF document.",
          variant: "destructive",
        })
        return
      }

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload a file smaller than 10MB.",
          variant: "destructive",
        })
        return
      }

      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload.",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    // Create form data
    const formData = new FormData()
    formData.append("file", selectedFile)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const newProgress = prev + 10
          if (newProgress >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return newProgress
        })
      }, 500)

      // Upload document
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        throw new Error("Failed to upload document")
      }

      const data = await response.json()

      toast({
        title: "Document uploaded successfully",
        description: `${data.tasksCreated} tasks have been created for ${data.roomsProcessed} rooms.`,
        variant: "default",
      })

      // Reset form
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("Error uploading document:", error)
      toast({
        title: "Upload failed",
        description: "There was an error uploading your document. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  // If not admin, show access denied
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-4 text-center max-w-md">
          You don't have permission to access this page. Only administrators can upload and process cleaning documents.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Document Processing</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Cleaning Document</CardTitle>
          <CardDescription>Upload A4 sheets with cleaning tasks to be processed by AI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-12 text-center hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,application/pdf"
              disabled={isUploading}
            />

            {selectedFile ? (
              <div className="flex flex-col items-center">
                <FileText className="h-10 w-10 text-primary mb-2" />
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                <p className="font-medium">Click to upload or drag and drop</p>
                <p className="text-sm text-muted-foreground">PDF or images of A4 cleaning sheets (max. 10MB)</p>
              </div>
            )}
          </div>

          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uploading and processing...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload & Process
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
          <CardDescription>Learn how document processing works in CleanTrack</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="rounded-full bg-primary/10 p-3">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium">1. Upload Document</h3>
              <p className="text-sm text-muted-foreground">Upload a scan or photo of your A4 cleaning task sheet</p>
            </div>

            <div className="flex flex-col items-center text-center space-y-2">
              <div className="rounded-full bg-primary/10 p-3">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium">2. AI Processing</h3>
              <p className="text-sm text-muted-foreground">
                Our AI extracts room numbers and cleaning tasks from your document
              </p>
            </div>

            <div className="flex flex-col items-center text-center space-y-2">
              <div className="rounded-full bg-primary/10 p-3">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-medium">3. Task Creation</h3>
              <p className="text-sm text-muted-foreground">Tasks are automatically created and assigned to rooms</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document Format Guidelines</CardTitle>
          <CardDescription>How to prepare your cleaning documents for optimal processing</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              For best results, ensure your cleaning documents follow these guidelines:
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="font-medium">Document Structure</h3>
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  <li>Clear building name at the top</li>
                  <li>Room numbers clearly visible</li>
                  <li>Tasks listed under each room</li>
                  <li>Priority levels indicated (if applicable)</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Image Quality</h3>
                <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                  <li>Good lighting with no shadows</li>
                  <li>High contrast between text and background</li>
                  <li>No blurry text or images</li>
                  <li>Entire document visible in frame</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
