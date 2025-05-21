"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

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
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile)
      setError(null)
    } else {
      setError('Please upload a PDF file')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile?.type === 'application/pdf') {
      setFile(selectedFile)
      setError(null)
    } else {
      setError('Please upload a PDF file')
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setIsProcessing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/process-document', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error processing document')
      }

      // Navigate to the cleaning tasks page after successful processing
      router.push('/cleaning')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing document')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-100">Upload Cleaning Document</h1>
          <p className="mt-2 text-gray-400">
            Upload a PDF document containing cleaning tasks. Our AI will analyze it and create a cleaning schedule.
          </p>
        </div>

        {/* Upload Area */}
        <motion.div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center ${
            isDragging ? 'border-teal-500 bg-teal-500/5' : 'border-white/10 hover:border-white/20'
          } transition-colors`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          animate={{ scale: isDragging ? 1.02 : 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <p className="text-lg text-gray-300">
                {file ? file.name : 'Drag and drop your PDF here'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {file ? 'Click to change file' : 'or click to browse'}
              </p>
            </div>
          </div>
        </motion.div>

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
            disabled={!file || isProcessing}
            className={`w-full py-3 rounded-lg flex items-center justify-center space-x-2 ${
              file && !isProcessing
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
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Process Document</span>
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
                <h3 className="text-sm font-medium text-gray-300 mb-2">Processing Steps:</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li className="flex items-center space-x-2">
                    <motion.span
                      className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    <span>Analyzing document structure</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <motion.span
                      className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: 0.2 }}
                    />
                    <span>Extracting cleaning tasks</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <motion.span
                      className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: 0.4 }}
                    />
                    <span>Creating cleaning schedule</span>
                  </li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
} 