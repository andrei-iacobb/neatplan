"use client"

export function Footer() {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-700/30 bg-gray-900/20 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="text-center">
          <p className="text-xs text-gray-300">
            © {currentYear} CleanTrack. All rights reserved. Developed by{' '}
            <a 
              href="https://andrei.iacob.uk/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-teal-300 font-medium hover:text-teal-200 transition-colors duration-200 cursor-pointer"
            >
              Andrei Iacob
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
} 