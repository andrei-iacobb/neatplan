"use client"

export function Footer() {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="border-t border-gray-700/50 bg-gray-900/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="text-center">
          <p className="text-xs text-gray-400">
            © {currentYear} CleanTrack. All rights reserved. Developed by{' '}
            <span className="text-teal-300 font-medium">Andrei Iacob</span>
          </p>
        </div>
      </div>
    </footer>
  )
} 