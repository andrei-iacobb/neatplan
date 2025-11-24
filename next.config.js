/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use environment variables for dynamic configuration
  env: {
    CUSTOM_APP_URL: process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000',
  },
  
  // Configure output for deployment
  output: 'standalone',
  

  
  // Configure images
  images: {
    domains: ['localhost'],
    // Add your production domains here
    // domains: ['localhost', 'yourdomain.com'],
  },
  
  // Ensure trailing slashes for consistent routing
  trailingSlash: false,
  // Make ESLint more tolerant during build
  eslint: {
    // Only run ESLint on the src directory (ignore generated files)
    dirs: ['src'],
    // Don't fail the build on ESLint warnings
    ignoreDuringBuilds: true,
  },
  // Make TypeScript more tolerant during build  
  typescript: {
    // Don't fail the build on TypeScript errors in generated files
    ignoreBuildErrors: false,
  },
  // Configure headers for better CORS handling and security
  async headers() {
    const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || process.env.NEXTAUTH_URL || 'http://localhost:3000'

    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: allowedOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
};

module.exports = nextConfig;
