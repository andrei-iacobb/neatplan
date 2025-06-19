"use client"

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Upload, X, FileText, Combine, Layers } from 'lucide-react'
import { apiRequest } from '@/lib/url-utils'

type ProcessingMode = 'combine' | 'individual' | null

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [processingMode, setProcessingMode] = useState<ProcessingMode>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const router = useRouter()
  const dropAreaRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => 
      file.type === 'application/pdf' || 
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles])
      setError(null)
    } else {
      setError('Please upload PDF or DOCX files only')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(file => 
      file.type === 'application/pdf' || 
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles])
      setError(null)
    } else {
      setError('Please upload PDF or DOCX files only')
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleProcessingModeSelect = (mode: ProcessingMode) => {
    setProcessingMode(mode)
  }

  const processIndividualDocuments = async () => {
    const results = []
    
    for (let i = 0; i < files.length; i++) {
      setCurrentFileIndex(i)
      
      try {
        const formData = new FormData()
        formData.append('file', files[i])

        const response = await apiRequest('/api/process-document', {
          method: 'POST',
          body: formData
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || `Error processing ${files[i].name}`)
        }

        results.push({
          file: files[i].name,
          schedule: data.schedule,
          success: true
        })
        
      } catch (err) {
        results.push({
          file: files[i].name,
          error: err instanceof Error ? err.message : 'Processing failed',
          success: false
        })
      }
    }
    
    return results
  }

  const processCombinedDocuments = async () => {
    const extractedContents = []
    
    // First, extract content from all documents
    for (let i = 0; i < files.length; i++) {
      setCurrentFileIndex(i)
      
      try {
        const formData = new FormData()
        formData.append('file', files[i])

        const response = await apiRequest('/api/extract-content', {
          method: 'POST',
          body: formData
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || `Error extracting content from ${files[i].name}`)
        }

        extractedContents.push({
          filename: files[i].name,
          content: data.content
        })
        
      } catch (err) {
        throw new Error(`Failed to process ${files[i].name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }
    
    // Combine all content with document separators
    const combinedContent = extractedContents.map(item => 
      `=== Document: ${item.filename} ===\n${item.content}\n\n`
    ).join('')
    
    // Process the combined content as a single schedule
    const response = await apiRequest('/api/ai/schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        content: combinedContent,
        title: `Combined Schedule from ${files.length} documents`
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create combined schedule')
    }

    return data
  }

  const handleUpload = async () => {
    if (files.length === 0) return
    
    // For single file, process immediately without mode selection
    if (files.length === 1) {
      setIsProcessing(true)
      setError(null)
      setCurrentFileIndex(0)

      try {
        const formData = new FormData()
        formData.append('file', files[0])

        const response = await apiRequest('/api/process-document', {
          method: 'POST',
          body: formData
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Error processing document')
        }

        router.push('/schedule')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error processing document')
      } finally {
        setIsProcessing(false)
      }
      return
    }

    // For multiple files, require processing mode
    if (!processingMode) return

    setIsProcessing(true)
    setError(null)
    setCurrentFileIndex(0)

    try {
      if (processingMode === 'individual') {
        const results = await processIndividualDocuments()
        
        // Check if any failed
        const failedFiles = results.filter(r => !r.success)
        if (failedFiles.length > 0) {
          setError(`Some files failed to process: ${failedFiles.map(f => f.file).join(', ')}`)
        }
        
        // Navigate to schedules page to see all created schedules
        router.push('/schedule')
        
      } else if (processingMode === 'combine') {
        await processCombinedDocuments()
        router.push('/schedule')
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing documents')
    } finally {
      setIsProcessing(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">AI Schedule Upload</h1>
          <p className="text-gray-400">Upload cleaning documents for intelligent schedule creation with automatic frequency detection</p>
        </div>

        {/* Upload Area */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-8 mb-8">
          <div
            ref={dropAreaRef}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
              isDragging
                ? 'border-teal-400 bg-teal-500/5'
                : 'border-gray-600 hover:border-teal-500/50 hover:bg-gray-700/30'
            }`}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-lg bg-teal-500/20 flex items-center justify-center">
                <Upload className="w-8 h-8 text-teal-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-100 mb-2">
                  Drop your files here or click to browse
                </h3>
                <p className="text-gray-400 text-sm">
                  Supports PDF and DOCX files up to 10MB each. Upload multiple files for batch processing.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx"
                multiple
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 rounded-lg border border-teal-500/30 transition-colors"
              >
                Choose Files
              </button>
            </div>
          </div>
        </div>

        {/* Document Preview */}
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6 mb-8"
          >
            <h3 className="text-lg font-medium text-gray-100 mb-4">
              Uploaded Documents ({files.length})
            </h3>
            <div className="space-y-3">
              {files.map((file, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg border border-gray-600"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="text-gray-100 font-medium">{file.name}</p>
                      <p className="text-gray-400 text-sm">
                        {formatFileSize(file.size)} • {file.type.includes('pdf') ? 'PDF' : 'DOCX'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Processing Mode Selection */}
        {files.length > 1 && !processingMode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 rounded-lg border border-gray-700 p-6 mb-8"
          >
            <h3 className="text-lg font-medium text-gray-100 mb-4">
              How would you like to process these documents?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => handleProcessingModeSelect('combine')}
                className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg hover:from-purple-500/20 hover:to-pink-500/20 transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Combine className="w-6 h-6 text-purple-400" />
                  <h4 className="text-lg font-medium text-gray-100">Combine into One Schedule</h4>
                </div>
                <p className="text-gray-400 text-sm">
                  Merge all documents into a single comprehensive cleaning schedule with all tasks combined.
                </p>
              </button>
              
              <button
                onClick={() => handleProcessingModeSelect('individual')}
                className="p-6 bg-gradient-to-br from-teal-500/10 to-blue-500/10 border border-teal-500/30 rounded-lg hover:from-teal-500/20 hover:to-blue-500/20 transition-all text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Layers className="w-6 h-6 text-teal-400" />
                  <h4 className="text-lg font-medium text-gray-100">Create Individual Schedules</h4>
                </div>
                <p className="text-gray-400 text-sm">
                  Create separate cleaning schedules for each document, maintaining their distinct purposes.
                </p>
              </button>
            </div>
          </motion.div>
        )}

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Button */}
        <div className="mt-6">
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || (files.length > 1 && !processingMode) || isProcessing}
            className={`w-full py-3 rounded-lg flex items-center justify-center space-x-2 ${
              files.length > 0 && (files.length === 1 || processingMode) && !isProcessing
                ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 hover:bg-teal-500/20'
                : 'bg-white/5 text-gray-400 border border-white/10 cursor-not-allowed'
            } transition-colors`}
          >
            {isProcessing ? (
              <>
                <motion.span
                  className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <span>
                  Processing... ({currentFileIndex + 1}/{files.length})
                </span>
              </>
            ) : (
              <>
                <span>
                  {files.length === 0 
                    ? 'Upload Documents' 
                    : files.length === 1 
                    ? 'Process Document' 
                    : processingMode === 'combine'
                    ? `Combine ${files.length} Documents`
                    : processingMode === 'individual'
                    ? `Create ${files.length} Individual Schedules`
                    : 'Select Processing Mode'
                  }
                </span>
              </>
            )}
          </button>
        </div>

        {/* Processing Steps */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8 space-y-4"
            >
              <div className="p-4 rounded-lg bg-black/20 backdrop-blur-sm border border-white/5">
                <h3 className="text-sm font-medium text-gray-300 mb-2">
                  AI Schedule Processing Steps:
                </h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-center space-x-2">
                    <motion.span
                      className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <span>
                      {processingMode === 'combine' 
                        ? `Extracting content from document ${currentFileIndex + 1}/${files.length}: ${files[currentFileIndex]?.name}`
                        : `Processing document ${currentFileIndex + 1}/${files.length}: ${files[currentFileIndex]?.name}`
                      }
                    </span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <motion.span
                      className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: 0.1 }}
                    />
                    <span>🤖 Detecting cleaning frequencies with AI</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <motion.span
                      className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: 0.2 }}
                    />
                    <span>✨ Extracting structured cleaning tasks</span>
                  </li>
                  {processingMode === 'combine' && (
                    <li className="flex items-center space-x-2">
                      <motion.span
                        className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: 0.3 }}
                      />
                      <span>🔗 Combining all documents into unified schedule</span>
                    </li>
                  )}
                </ul>
                <div className="mt-3 p-2 bg-teal-500/10 border border-teal-500/30 rounded text-xs text-teal-300">
                  💡 {processingMode === 'combine' 
                    ? 'All documents will be merged into one comprehensive schedule!'
                    : 'Each document will become a separate schedule for better organization!'
                  }
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}