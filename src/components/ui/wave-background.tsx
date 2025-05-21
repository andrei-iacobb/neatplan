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
  return Array.from({ length: 45 }, (_, i) => ({
    startPosition: {
      x: Math.random() * 100,
      y: -20
    },
    size: Math.random() * 3 + (i % 3 === 0 ? 3 : 1),
    opacity: Math.random() * 0.4 + 0.3,
    duration: Math.random() * 4 + 12
  }))
}

export function WaveBackground() {
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    setParticles(generateParticles())
  }, [])

  return (
    <div className="fixed inset-0 -z-10 bg-gray-900">
      {/* Shoreline gradient effect */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, 
            rgba(17, 24, 39, 1) 0%,
            rgba(17, 24, 39, 0.8) 40%,
            rgba(45, 212, 191, 0.2) 60%,
            rgba(45, 212, 191, 0.1) 80%,
            transparent 100%)`
        }}
        animate={{
          y: ["20%", "-20%", "20%"]
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Main wave effect */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, 
            transparent 0%,
            rgba(45, 212, 191, 0.1) 40%,
            rgba(45, 212, 191, 0.2) 60%,
            transparent 100%)`
        }}
        animate={{
          y: ["0%", "100%", "0%"]
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Secondary wave for depth */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, 
            transparent 0%,
            rgba(45, 212, 191, 0.05) 30%,
            rgba(45, 212, 191, 0.15) 70%,
            transparent 100%)`
        }}
        animate={{
          y: ["-50%", "50%", "-50%"]
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Particles in the water - moved to top layer */}
      <div className="absolute inset-0" style={{ zIndex: 10 }}>
        {particles.map((particle, i) => (
          <motion.div
            key={`particle-${i}`}
            className="block absolute rounded-full"
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              background: `rgba(45, 212, 191, ${particle.opacity})`,
              boxShadow: `
                0 0 ${particle.size * 4}px rgba(45, 212, 191, ${particle.opacity}),
                0 0 ${particle.size * 8}px rgba(45, 212, 191, ${particle.opacity * 0.5})
              `,
              left: `${particle.startPosition.x}vw`,
              top: `${particle.startPosition.y}vh`,
            }}
            animate={{
              y: ["0vh", "120vh"],
              x: [
                `${particle.startPosition.x}vw`,
                `${particle.startPosition.x + Math.sin(i) * 20}vw`,
                `${particle.startPosition.x - Math.sin(i) * 20}vw`,
                `${particle.startPosition.x}vw`
              ],
              opacity: [0, particle.opacity, particle.opacity, 0],
              scale: [1, 1.2, 1, 0.8]
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: i * 0.4,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    </div>
  )
} 