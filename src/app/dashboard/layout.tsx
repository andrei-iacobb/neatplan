"use client"

import { Sidebar } from "@/components/ui/sidebar"
import { motion } from "framer-motion"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen relative">
      {/* Content */}
      <div className="relative z-20">
        <Sidebar />
        <motion.div
          className="min-h-screen"
          initial={false}
          animate={{
            paddingLeft: "48px",
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
} 