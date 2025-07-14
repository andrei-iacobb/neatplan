'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useSettings } from '@/contexts/settings-context'

type SoundType = 'click' | 'success' | 'error' | 'notification' | 'hover' | 'swipe' | 'complete'

interface SoundConfig {
  frequency: number
  duration: number
  type: 'sine' | 'square' | 'sawtooth' | 'triangle'
  volume: number
}

const soundConfigs: Record<SoundType, SoundConfig> = {
  click: { frequency: 800, duration: 50, type: 'sine', volume: 0.1 },
  hover: { frequency: 600, duration: 30, type: 'sine', volume: 0.05 },
  success: { frequency: 523, duration: 200, type: 'sine', volume: 0.15 },
  error: { frequency: 220, duration: 300, type: 'sawtooth', volume: 0.2 },
  notification: { frequency: 440, duration: 150, type: 'triangle', volume: 0.12 },
  swipe: { frequency: 300, duration: 100, type: 'sine', volume: 0.08 },
  complete: { frequency: 660, duration: 400, type: 'sine', volume: 0.15 }
}

export function useSoundEffects() {
  const { settings } = useSettings()
  const audioContextRef = useRef<AudioContext | null>(null)
  const isInitializedRef = useRef(false)

  // Initialize audio context on first user interaction
  const initializeAudio = useCallback(() => {
    if (!isInitializedRef.current && typeof window !== 'undefined') {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
        isInitializedRef.current = true
      } catch (error) {
        console.warn('Audio context not supported:', error)
      }
    }
  }, [])

  // Play a sound effect
  const playSound = useCallback((soundType: SoundType) => {
    if (!settings.display.soundEnabled) return
    
    try {
      initializeAudio()
      
      if (!audioContextRef.current) return

      const config = soundConfigs[soundType]
      const oscillator = audioContextRef.current.createOscillator()
      const gainNode = audioContextRef.current.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)

      oscillator.frequency.setValueAtTime(config.frequency, audioContextRef.current.currentTime)
      oscillator.type = config.type

      gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime)
      gainNode.gain.linearRampToValueAtTime(config.volume, audioContextRef.current.currentTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + config.duration / 1000)

      oscillator.start(audioContextRef.current.currentTime)
      oscillator.stop(audioContextRef.current.currentTime + config.duration / 1000)
    } catch (error) {
      console.warn('Error playing sound:', error)
    }
  }, [settings.display.soundEnabled, initializeAudio])

  // Play success sequence (multiple tones)
  const playSuccessSequence = useCallback(() => {
    if (!settings.display.soundEnabled) return
    
    const frequencies = [523, 659, 784] // C, E, G
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        try {
          initializeAudio()
          if (!audioContextRef.current) return

          const oscillator = audioContextRef.current.createOscillator()
          const gainNode = audioContextRef.current.createGain()

          oscillator.connect(gainNode)
          gainNode.connect(audioContextRef.current.destination)

          oscillator.frequency.setValueAtTime(freq, audioContextRef.current.currentTime)
          oscillator.type = 'sine'

          gainNode.gain.setValueAtTime(0, audioContextRef.current.currentTime)
          gainNode.gain.linearRampToValueAtTime(0.1, audioContextRef.current.currentTime + 0.01)
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.15)

          oscillator.start(audioContextRef.current.currentTime)
          oscillator.stop(audioContextRef.current.currentTime + 0.15)
        } catch (error) {
          console.warn('Error playing success sequence:', error)
        }
      }, index * 100)
    })
  }, [settings.display.soundEnabled, initializeAudio])

  // Initialize audio context on component mount
  useEffect(() => {
    const handleFirstInteraction = () => {
      initializeAudio()
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
    }

    document.addEventListener('click', handleFirstInteraction)
    document.addEventListener('keydown', handleFirstInteraction)

    return () => {
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
    }
  }, [initializeAudio])

  return {
    playSound,
    playSuccessSequence,
    isEnabled: settings.display.soundEnabled
  }
} 