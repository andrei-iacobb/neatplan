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
