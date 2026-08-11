/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  serverExternalPackages: ['pdf-parse'],
  // Keep deterministic build metadata available to the client-rendered footer.
  env: {
    NEXT_PUBLIC_COPYRIGHT_YEAR: String(new Date().getFullYear()),
  },
  
  // Configure output for deployment
  output: 'standalone',

  experimental: {
    useOffline: true,
    turbopackRustReactCompiler: true,
    instantInsights: {
      validationLevel: 'warning',
    },
    exposeTestingApiInProductionBuild: process.env.NEXT_TEST_MODE === '1',
    // Next already does this for lucide-react and date-fns by default, but not for
    // framer-motion - which the root layout pulls in via SettingsProvider, so it lands
    // in the first-load bundle of every route including the login screen.
    optimizePackageImports: ['framer-motion'],
  },

  // Note: the instrumentation hook (src/instrumentation.ts, which starts the in-process
  // scheduler) is stable as of Next 15, so no experimental flag is needed.


  
  // Configure images
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  
  // Ensure trailing slashes for consistent routing
  trailingSlash: false,
  // Configure headers for better CORS handling and security
  async headers() {
    const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const scriptSources = process.env.NODE_ENV === 'development'
      ? "'self' 'unsafe-inline' 'unsafe-eval' https://plausible.iacob.co.uk"
      : "'self' 'unsafe-inline' https://plausible.iacob.co.uk"

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
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Content-Security-Policy', value: `default-src 'self'; script-src ${scriptSources}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://plausible.iacob.co.uk; frame-ancestors 'none';` },
        ],
      },
    ]
  },
};

module.exports = nextConfig;
