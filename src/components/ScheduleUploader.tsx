'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2, Upload } from 'lucide-react'
import { Schedule } from '@/generated/prisma'

interface ScheduleUploaderProps {
  onScheduleGenerated: (schedule: Schedule) => void
}

export function ScheduleUploader({ onScheduleGenerated }: ScheduleUploaderProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showInput, setShowInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.toLowerCase().match(/\.(docx|pdf)$/)) {
      toast.error('Please upload a .docx or .pdf file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Please upload a file smaller than 5MB')
      return
    }

    try {
      setIsLoading(true)

      // Create FormData to handle file
      const formData = new FormData()
      formData.append('file', file)

      // First, upload and process the file
      const fileContent = await readFileContent(file)

      // Call OpenAI API
      const response = await fetch('/api/ai/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fileContent })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate schedule')
      }

      const { schedule } = await response.json()
      onScheduleGenerated(schedule)

      toast.success('Schedule generated successfully')
      
      // Hide the input after successful upload
      setShowInput(false)
    } catch (error: any) {
      console.error('Error generating schedule:', error)
      toast.error(error.message || 'Failed to generate schedule')
    } finally {
      setIsLoading(false)
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleButtonClick = () => {
    if (!isLoading) {
      setShowInput(true)
      // Focus the file input
      setTimeout(() => {
        fileInputRef.current?.click()
      }, 100)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-gray-400 text-sm mb-4">
        Upload a document containing your cleaning schedule details. We'll automatically process it and create a structured schedule.
      </p>
      
      <div className="relative">
        <Button
          onClick={handleButtonClick}
          disabled={isLoading}
          variant="outline"
          className="w-full bg-gray-800/50 border-gray-700 hover:bg-gray-800 hover:border-gray-600 transition-colors"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {isLoading ? "Processing..." : "Select Document"}
        </Button>
        
        <Input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pdf"
          onChange={handleFileUpload}
          disabled={isLoading}
          className="hidden"
        />
      </div>
      
      <p className="text-xs text-gray-500">
        Accepts .docx or .pdf files (max 5MB)
      </p>
    </div>
  )
}

async function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result
        if (typeof content === 'string') {
          resolve(content)
        } else {
          reject(new Error('Failed to read file content'))
        }
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
} 