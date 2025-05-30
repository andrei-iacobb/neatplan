"use client"

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile?.type === 'application/pdf' || 
        droppedFile?.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      setFile(droppedFile)
      setError(null)
    } else {
      setError('Please upload a PDF or DOCX file')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile?.type === 'application/pdf' || 
        selectedFile?.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      setFile(selectedFile)
      setError(null)
    } else {
      setError('Please upload a PDF or DOCX file')
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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile?.type === 'application/pdf' || 
        selectedFile?.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      setFile(selectedFile)
      setError(null)
    } else {
      setError('Please upload a PDF or DOCX file')
    }
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Document Upload</h1>
          <p className="text-gray-400">Upload cleaning documents for AI processing and task generation</p>
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
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
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
                  Supports PDF and DOCX files up to 10MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx"
                onChange={handleFileSelect}
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
                <h3 className="text-sm font-medium text-gray-300 mb-2">
                  Processing Steps ({file?.type === 'application/pdf' ? 'OCR Method' : 'Text Extraction + NLP Method'}):
                </h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  {file?.type === 'application/pdf' ? (
                    <>
                      <li className="flex items-center space-x-2">
                        <motion.span
                          className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        <span>Performing OCR on PDF document</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <motion.span
                          className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: 0.2 }}
                        />
                        <span>Extracting text content</span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-center space-x-2">
                        <motion.span
                          className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        <span>Extracting text from DOCX</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <motion.span
                          className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: 0.1 }}
                        />
                        <span>Running NLP analysis</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <motion.span
                          className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: 0.2 }}
                        />
                        <span>Filtering relevant content</span>
                      </li>
                    </>
                  )}
                  <li className="flex items-center space-x-2">
                    <motion.span
                      className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: 0.4 }}
                    />
                    <span>AI processing and task extraction</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <motion.span
                      className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: 0.6 }}
                    />
                    <span>Creating structured cleaning tasks</span>
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