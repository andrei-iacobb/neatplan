"use client"

import Image from "next/image"
import { getLogo, type LogoVariant } from "@/lib/assets"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface LogoProps {
  variant?: LogoVariant
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom'
  width?: number
  height?: number
  className?: string
  alt?: string
  priority?: boolean
}

const sizeMap = {
  xs: { width: 24, height: 24 },
  sm: { width: 32, height: 32 },
  md: { width: 48, height: 48 },
  lg: { width: 64, height: 64 },
  xl: { width: 96, height: 96 },
  custom: { width: undefined, height: undefined }
}

export function Logo({ 
  variant = 'main',
  size = 'md',
  width,
  height,
  className,
  alt = 'CleanTrack Logo',
  priority = false
}: LogoProps) {
  const [imageError, setImageError] = useState(false)
  const logoSrc = getLogo(variant)
  
  // Use custom dimensions if provided, otherwise use size preset
  const dimensions = size === 'custom' 
    ? { width: width || 48, height: height || 48 }
    : sizeMap[size]

  // Fallback logo component
  const FallbackLogo = () => (
    <div 
      className={cn(
        "bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg",
        className
      )}
      style={{
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
      }}
    >
      <div 
        className="bg-white rounded-lg opacity-90"
        style={{
          width: `${dimensions.width * 0.5}px`,
          height: `${dimensions.height * 0.5}px`,
        }}
      />
    </div>
  )

  // If image failed to load, show fallback
  if (imageError) {
    return <FallbackLogo />
  }

  // Try to load the actual logo
  return (
    <img
      src={logoSrc}
      alt={alt}
      width={dimensions.width}
      height={dimensions.height}
      className={cn(
        "object-contain",
        className
      )}
      style={{
        maxWidth: `${dimensions.width}px`,
        maxHeight: `${dimensions.height}px`,
        width: 'auto',
        height: 'auto'
      }}
      onError={(e) => {
        console.error('Logo failed to load:', logoSrc)
        setImageError(true)
      }}
      onLoad={() => {
        console.log('Logo loaded successfully:', logoSrc)
      }}
    />
  )
}

// Logo with text variant
interface LogoWithTextProps extends Omit<LogoProps, 'alt'> {
  showText?: boolean
  textClassName?: string
  textSize?: 'sm' | 'md' | 'lg' | 'xl'
}

export function LogoWithText({ 
  showText = true,
  textClassName,
  textSize = 'lg',
  className,
  ...logoProps 
}: LogoWithTextProps) {
  const textSizeMap = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl'
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Logo {...logoProps} alt="CleanTrack" />
      {showText && (
        <span className={cn(
          "font-bold text-gray-100",
          textSizeMap[textSize],
          textClassName
        )}>
          CleanTrack
        </span>
      )}
    </div>
  )
} 