"use client"

import type React from "react"

import type { NextPage } from "next"
import Head from "next/head"
import { useSession } from "next-auth/react"
import { useRouter } from "next/router"
import { useState, useEffect, useRef } from "react"
import { api } from "~/utils/api"
import DashboardLayout from "~/components/layouts/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { useToast } from "~/components/ui/use-toast"
import { Upload, FileText, Check, Loader2, Camera } from "lucide-react"
import Image from "next/image"

const DocumentScanPage: NextPage = () => {
  const { data: sessionData, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      void router.push("/api/auth/signin")
    } else if (status === "authenticated") {
      setIsLoading(false)
    }
  }, [status, router])

  // Clean up object URL when component unmounts or when file changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // tRPC mutation for uploading and processing document
  const processDocumentMutation = api.documents.processDocument.useMutation({
    onSuccess: (data) => {
      setIsUploading(false)
      setUploadProgress(100)

      toast({
        title: "Document processed successfully",
        description: `${data.tasksCreated} tasks have been created for ${data.roomsProcessed} rooms.`,
      })

      // Reset form
      setSelectedFile(null)
      setPreviewUrl(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        void router.push("/dashboard")
      }, 2000)
    },
    onError: (error) => {
      setIsUploading(false)
      setUploadProgress(0)

      toast({
        title: "Error processing document",
        description: error.message,
        variant: "destructive",
      })
    },
  })

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

      // Create preview for images
      if (file.type.includes("image/")) {
        const objectUrl = URL.createObjectURL(file)
        setPreviewUrl(objectUrl)
      } else {
        // For PDFs, just show a placeholder
        setPreviewUrl(null)
      }
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

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        const newProgress = prev + 5
        if (newProgress >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return newProgress
      })
    }, 300)

    // Create form data
    const formData = new FormData()
    formData.append("file", selectedFile)

    // Process document using tRPC mutation
    processDocumentMutation.mutate({ formData })
  }

  const handleTakePhoto = () => {
    // Open camera if available
    if (fileInputRef.current) {
      fileInputRef.current.accept = "image/*"
      fileInputRef.current.capture = "environment"
      fileInputRef.current.click()
    }
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
        <title>Scan Document | CleanTrack</title>
      </Head>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Scan Cleaning Document</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Upload Cleaning Document</CardTitle>
              <CardDescription>Upload a scan or photo of your cleaning task sheet</CardDescription>
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

                {previewUrl ? (
                  <div className="flex flex-col items-center">
                    <div className="relative w-64 h-64 mb-4">
                      <Image
                        src={previewUrl || "/placeholder.svg"}
                        alt="Document preview"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <p className="font-medium">{selectedFile?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) + " MB" : ""}
                    </p>
                  </div>
                ) : selectedFile?.type.includes("application/pdf") ? (
                  <div className="flex flex-col items-center">
                    <FileText className="h-16 w-16 text-teal-600 mb-4" />
                    <p className="font-medium">{selectedFile?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) + " MB" : ""}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="font-medium">Click to upload or drag and drop</p>
                    <p className="text-sm text-muted-foreground">PDF or images of cleaning sheets (max. 10MB)</p>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <Button variant="outline" className="flex-1" onClick={handleTakePhoto} disabled={isUploading}>
                  <Camera className="mr-2 h-4 w-4" />
                  Take Photo
                </Button>

                <Button className="flex-1" onClick={handleUpload} disabled={!selectedFile || isUploading}>
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

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading and processing...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
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
                  <div className="rounded-full bg-teal-100 p-3">
                    <Upload className="h-6 w-6 text-teal-600" />
                  </div>
                  <h3 className="font-medium">1. Upload Document</h3>
                  <p className="text-sm text-muted-foreground">Upload a scan or photo of your cleaning task sheet</p>
                </div>

                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="rounded-full bg-teal-100 p-3">
                    <FileText className="h-6 w-6 text-teal-600" />
                  </div>
                  <h3 className="font-medium">2. AI Processing</h3>
                  <p className="text-sm text-muted-foreground">
                    Our AI extracts room numbers and cleaning tasks from your document
                  </p>
                </div>

                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="rounded-full bg-teal-100 p-3">
                    <Check className="h-6 w-6 text-teal-600" />
                  </div>
                  <h3 className="font-medium">3. Task Creation</h3>
                  <p className="text-sm text-muted-foreground">Tasks are automatically created and assigned to rooms</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  )
}

export default DocumentScanPage
