"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"

interface Particle {
  startPosition: {
    x: number
    y: number
  }
  size: number
  opacity: number
  duration: number
}

function generateParticles(): Particle[] {
  return Array.from({ length: 30 }, (_, i) => ({
    startPosition: {
      x: Math.random() * 100,
      y: -20
    },
    size: Math.random() * 2 + 1,
    opacity: Math.random() * 0.3 + 0.1,
    duration: Math.random() * 8 + 15
  }))
}

export function WaveBackground() {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    setParticles(generateParticles())
  }, [])

  return (
    <div className="fixed inset-0 -z-10">
      {/* Base - seamless dark gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, 
            #0f172a 0%,
            #1e293b 30%,
            #334155 60%,
            #1e293b 90%,
            #0f172a 100%)`
        }}
      />

      {/* Very subtle animated overlay - barely visible */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 30% 20%, 
            rgba(59, 130, 246, 0.03) 0%,
            transparent 50%),
            radial-gradient(ellipse at 70% 80%, 
            rgba(99, 102, 241, 0.02) 0%,
            transparent 50%)`
        }}
        animate={{
          opacity: [0.5, 0.8, 0.5]
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Extremely subtle moving gradient */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(45deg, 
            rgba(59, 130, 246, 0.02) 0%,
            transparent 25%,
            rgba(99, 102, 241, 0.01) 50%,
            transparent 75%,
            rgba(59, 130, 246, 0.02) 100%)`,
          backgroundSize: '200% 200%'
        }}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear"
        }}
      />

      {/* Minimal floating particles */}
      <div className="absolute inset-0">
        {particles.map((particle, i) => (
          <motion.div
            key={`particle-${i}`}
            className="block absolute rounded-full"
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              background: `rgba(148, 163, 184, ${particle.opacity})`,
              boxShadow: `0 0 ${particle.size * 2}px rgba(148, 163, 184, ${particle.opacity * 0.3})`,
              left: `${particle.startPosition.x}vw`,
              top: `${particle.startPosition.y}vh`,
            }}
            animate={{
              y: ["0vh", "120vh"],
              x: [
                `${particle.startPosition.x}vw`,
                `${particle.startPosition.x + Math.sin(i) * 15}vw`,
                `${particle.startPosition.x - Math.sin(i) * 15}vw`,
                `${particle.startPosition.x}vw`
              ],
              opacity: [0, particle.opacity, particle.opacity, 0]
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "linear"
            }}
          />
        ))}
      </div>

      {/* Subtle noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px'
        }}
      />
    </div>
  )
} 