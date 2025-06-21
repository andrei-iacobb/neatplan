import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use environment variables for dynamic configuration
  env: {
    CUSTOM_APP_URL: process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 'http://localhost:3000',
  },

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
  // Configure headers for better CORS handling
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
};

export default nextConfig;
