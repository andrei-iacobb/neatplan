"use client"

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Upload, X, FileText, Combine, Layers, Sparkles } from 'lucide-react'
import { apiRequest } from '@/lib/url-utils'
import { useThemeColors } from '@/hooks/useThemeColors'

type ProcessingMode = 'combine' | 'individual' | null

const fadeUp = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [processingMode, setProcessingMode] = useState<ProcessingMode>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [hoveredMode, setHoveredMode] = useState<string | null>(null)
  const router = useRouter()
  const dropAreaRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const tc = useThemeColors()

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

  const isUploadEnabled = files.length > 0 && (files.length === 1 || processingMode) && !isProcessing

  return (
    <div className="max-w-[1100px] mx-auto relative z-10 pb-8">
      {/* Page Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4" style={{ color: 'rgb(16,185,129)' }} />
          <p className="text-[13px] font-medium tracking-wide uppercase" style={{ color: tc.accentLabel }}>Document Processing</p>
        </div>
        <h1 className="text-[32px] font-bold tracking-tight mb-1" style={{ color: tc.textPrimary }}>AI Schedule Upload</h1>
        <p className="text-[15px]" style={{ color: tc.textMuted }}>
          Upload cleaning documents for intelligent schedule creation with automatic frequency detection
        </p>
      </div>

      {/* Upload Area */}
      <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.05 }}
        className="rounded-xl p-6 mb-4"
        style={{ background: tc.cardBg, border: '1px solid ' + tc.cardBorder, boxShadow: tc.shadow }}>
        <div
          ref={dropAreaRef}
          className="rounded-xl p-8 text-center transition-all duration-200 cursor-pointer"
          style={{
            border: '2px dashed ' + (isDragging ? tc.dropzoneActiveBorder : tc.dropzoneBorder),
            background: isDragging ? tc.dropzoneActiveBg : tc.dropzoneBg,
          }}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ background: tc.btnPrimaryBg }}>
              <Upload className="w-8 h-8" style={{ color: 'rgb(16,185,129)' }} />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold mb-2" style={{ color: tc.textPrimary }}>
                Drop your files here or click to browse
              </h3>
              <p className="text-[13px]" style={{ color: tc.textMuted }}>
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
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
              className="px-6 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-200"
              style={{ background: tc.btnPrimaryBg, color: tc.btnPrimaryText, border: '1px solid ' + tc.btnPrimaryBorder }}
              onMouseEnter={(e) => { e.currentTarget.style.background = tc.btnPrimaryHoverBg }}
              onMouseLeave={(e) => { e.currentTarget.style.background = tc.btnPrimaryBg }}
            >
              Choose Files
            </button>
          </div>
        </div>
      </motion.div>

      {/* Document Preview */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="rounded-xl p-5 mb-4"
            style={{ background: tc.cardBg, border: '1px solid ' + tc.cardBorder, boxShadow: tc.shadow }}
          >
            <h3 className="text-[15px] font-semibold mb-4" style={{ color: tc.textPrimary }}>
              Uploaded Documents ({files.length})
            </h3>
            <div className="space-y-2">
              {files.map((file, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: tc.emptyBg, border: '1px solid ' + tc.cardBorder }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${tc.accentBlue}${tc.iconBgAlpha}` }}>
                      <FileText className="w-4 h-4" style={{ color: tc.accentBlue }} />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: tc.textPrimary }}>{file.name}</p>
                      <p className="text-[11px]" style={{ color: tc.textMuted }}>
                        {formatFileSize(file.size)} &middot; {file.type.includes('pdf') ? 'PDF' : 'DOCX'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1.5 rounded-md transition-colors duration-150"
                    style={{ color: tc.textMuted }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = tc.accentRed; e.currentTarget.style.background = tc.btnDangerBg }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = tc.textMuted; e.currentTarget.style.background = 'transparent' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Processing Mode Selection */}
      <AnimatePresence>
        {files.length > 1 && !processingMode && (
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="rounded-xl p-5 mb-4"
            style={{ background: tc.cardBg, border: '1px solid ' + tc.cardBorder, boxShadow: tc.shadow }}
          >
            <h3 className="text-[15px] font-semibold mb-4" style={{ color: tc.textPrimary }}>
              How would you like to process these documents?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={() => handleProcessingModeSelect('combine')}
                className="p-5 rounded-xl text-left transition-all duration-200 relative overflow-hidden"
                style={{
                  background: tc.cardBg,
                  border: '1px solid ' + (hoveredMode === 'combine' ? tc.cardHoverBorder(tc.accentIndigo) : tc.cardBorder),
                  boxShadow: hoveredMode === 'combine' ? `0 0 20px ${tc.accentIndigo}${tc.glowOpacity === '0.06' ? '10' : '08'}` : tc.shadow,
                }}
                onMouseEnter={(e) => { setHoveredMode('combine'); e.currentTarget.style.background = tc.cardHoverBg }}
                onMouseLeave={(e) => { setHoveredMode(null); e.currentTarget.style.background = tc.cardBg }}
              >
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-8 translate-x-8" style={{ background: tc.accentIndigo, opacity: tc.glowOpacity }} />
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${tc.accentIndigo}${tc.iconBgAlpha}` }}>
                    <Combine className="w-[18px] h-[18px]" style={{ color: tc.accentIndigo }} strokeWidth={1.8} />
                  </div>
                  <h4 className="text-[14px] font-semibold" style={{ color: tc.textPrimary }}>Combine into One Schedule</h4>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: tc.textMuted }}>
                  Merge all documents into a single comprehensive cleaning schedule with all tasks combined.
                </p>
              </button>

              <button
                onClick={() => handleProcessingModeSelect('individual')}
                className="p-5 rounded-xl text-left transition-all duration-200 relative overflow-hidden"
                style={{
                  background: tc.cardBg,
                  border: '1px solid ' + (hoveredMode === 'individual' ? tc.cardHoverBorder(tc.accentGreen) : tc.cardBorder),
                  boxShadow: hoveredMode === 'individual' ? `0 0 20px ${tc.accentGreen}${tc.glowOpacity === '0.06' ? '10' : '08'}` : tc.shadow,
                }}
                onMouseEnter={(e) => { setHoveredMode('individual'); e.currentTarget.style.background = tc.cardHoverBg }}
                onMouseLeave={(e) => { setHoveredMode(null); e.currentTarget.style.background = tc.cardBg }}
              >
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-8 translate-x-8" style={{ background: tc.accentGreen, opacity: tc.glowOpacity }} />
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${tc.accentGreen}${tc.iconBgAlpha}` }}>
                    <Layers className="w-[18px] h-[18px]" style={{ color: tc.accentGreen }} strokeWidth={1.8} />
                  </div>
                  <h4 className="text-[14px] font-semibold" style={{ color: tc.textPrimary }}>Create Individual Schedules</h4>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: tc.textMuted }}>
                  Create separate cleaning schedules for each document, maintaining their distinct purposes.
                </p>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-4 rounded-xl text-[13px] font-medium"
            style={{ background: tc.statusOverdue.bg, border: '1px solid ' + tc.statusOverdue.border, color: tc.statusOverdue.text }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Button */}
      <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.2 }}>
        <button
          onClick={handleUpload}
          disabled={!isUploadEnabled}
          className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-[14px] font-semibold transition-all duration-200"
          style={isUploadEnabled ? {
            background: tc.btnPrimaryBg,
            color: tc.btnPrimaryText,
            border: '1px solid ' + tc.btnPrimaryBorder,
          } : {
            background: tc.emptyBg,
            color: tc.textFaint,
            border: '1px solid ' + tc.cardBorder,
            cursor: 'not-allowed',
          }}
          onMouseEnter={(e) => { if (isUploadEnabled) e.currentTarget.style.background = tc.btnPrimaryHoverBg }}
          onMouseLeave={(e) => { if (isUploadEnabled) e.currentTarget.style.background = tc.btnPrimaryBg }}
        >
          {isProcessing ? (
            <>
              <motion.span
                className="w-4 h-4 rounded-full"
                style={{ border: '2px solid transparent', borderTopColor: 'rgb(16,185,129)', borderRightColor: 'rgba(16,185,129,0.3)' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <span>
                Processing... ({currentFileIndex + 1}/{files.length})
              </span>
            </>
          ) : (
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
          )}
        </button>
      </motion.div>

      {/* Processing Steps */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4"
          >
            <div className="rounded-xl p-5"
              style={{ background: tc.cardBg, border: '1px solid ' + tc.cardBorder, boxShadow: tc.shadow }}>
              <h3 className="text-[13px] font-semibold mb-3" style={{ color: tc.textPrimary }}>
                AI Schedule Processing Steps:
              </h3>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2.5">
                  <motion.span
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={{ border: '2px solid transparent', borderTopColor: 'rgb(16,185,129)', borderRightColor: 'rgba(16,185,129,0.3)' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  <span className="text-[12px] font-medium" style={{ color: tc.textSecondary }}>
                    {processingMode === 'combine'
                      ? `Extracting content from document ${currentFileIndex + 1}/${files.length}: ${files[currentFileIndex]?.name}`
                      : `Processing document ${currentFileIndex + 1}/${files.length}: ${files[currentFileIndex]?.name}`
                    }
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <motion.span
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={{ border: '2px solid transparent', borderTopColor: 'rgb(16,185,129)', borderRightColor: 'rgba(16,185,129,0.3)' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: 0.1 }}
                  />
                  <span className="text-[12px] font-medium" style={{ color: tc.textSecondary }}>Detecting cleaning frequencies with AI</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <motion.span
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={{ border: '2px solid transparent', borderTopColor: 'rgb(16,185,129)', borderRightColor: 'rgba(16,185,129,0.3)' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: 0.2 }}
                  />
                  <span className="text-[12px] font-medium" style={{ color: tc.textSecondary }}>Extracting structured cleaning tasks</span>
                </li>
                {processingMode === 'combine' && (
                  <li className="flex items-center gap-2.5">
                    <motion.span
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                      style={{ border: '2px solid transparent', borderTopColor: 'rgb(16,185,129)', borderRightColor: 'rgba(16,185,129,0.3)' }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear", delay: 0.3 }}
                    />
                    <span className="text-[12px] font-medium" style={{ color: tc.textSecondary }}>Combining all documents into unified schedule</span>
                  </li>
                )}
              </ul>
              <div className="mt-4 p-3 rounded-lg text-[12px] font-medium"
                style={{ background: tc.btnPrimaryBg, border: '1px solid ' + tc.btnPrimaryBorder, color: tc.btnPrimaryText }}>
                {processingMode === 'combine'
                  ? 'All documents will be merged into one comprehensive schedule!'
                  : 'Each document will become a separate schedule for better organization!'
                }
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
