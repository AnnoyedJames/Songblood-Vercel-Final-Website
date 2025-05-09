/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for development
  reactStrictMode: true,

  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Configure image domains if needed
  images: {
    domains: ['localhost', 'vercel.app'],
    unoptimized: true,
  },
  
  // Environment variables that will be available at build time
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
    IS_FALLBACK_MODE: process.env.IS_FALLBACK_MODE || 'false',
    BUILD_ID: process.env.BUILD_ID || 'local',
  },
  
  // Experimental features
  experimental: {
    // Enable server components
    serverComponents: true,
    // Disable optimizeCss to avoid critters dependency
    optimizeCss: false,
    // Enable scroll restoration
    scrollRestoration: true,
  },
  
  // Configure redirects
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ]
  },
  
  // Configure headers
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
  
  // Configure webpack if needed
  webpack: (config, { isServer }) => {
    // Custom webpack config here
    return config
  },
}

export default nextConfig
