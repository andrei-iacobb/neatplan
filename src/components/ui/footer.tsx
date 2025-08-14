"use client"

export function Footer() {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="w-full border-t border-gray-700/50 bg-gray-900/80 backdrop-blur-sm flex-shrink-0">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="text-center">
          <p className="text-xs text-gray-400">
            © {currentYear} NeatPlan. All rights reserved. Developed by{' '}
            <a 
              href="https://andrei.iacob.uk/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-300 font-medium hover:text-blue-200 transition-colors duration-200 cursor-pointer"
            >
              Andrei Iacob
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
} 