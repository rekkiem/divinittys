/** @type {import('next').NextConfig} */
/**
 * IMPORTANTE (prod):
 * - NO usar experimental.instrumentationHook con este proyecto.
 *   instrumentation → logger (node:fs) / bullmq rompe `next build` en webpack.
 * - Los workers BullMQ corren en el servicio Docker `workers` (target tools).
 */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  compress: true,

  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '9000', pathname: '/imagenes/**' },
      { protocol: 'http', hostname: 'localhost', port: '9000', pathname: '/**' },
      { protocol: 'http', hostname: '127.0.0.1', port: '9000', pathname: '/**' },
      { protocol: 'http', hostname: 'minio', port: '9000', pathname: '/imagenes/**' },
      { protocol: 'http', hostname: 'minio', port: '9000', pathname: '/**' },
      { protocol: 'https', hostname: 'media.divinittys.cl', pathname: '/**' },
      { protocol: 'http', hostname: 'media.divinittys.cl', pathname: '/**' },
      { protocol: 'https', hostname: 'divinittys.cl', pathname: '/media/**' },
      { protocol: 'https', hostname: 'www.divinittys.cl', pathname: '/media/**' },
      { protocol: 'https', hostname: 'prep.divinittys.cl', pathname: '/media/**' },
      { protocol: 'https', hostname: 'prep.divinittys.cl', pathname: '/**' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com', pathname: '/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: 'http2.mlstatic.com', pathname: '/**' },
      { protocol: 'https', hostname: '**.mlstatic.com', pathname: '/**' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 3600,
    unoptimized: process.env.NODE_ENV === 'development',
  },

  experimental: {
    serverComponentsExternalPackages: [
      'bcryptjs',
      '@prisma/client',
      'prisma',
      'meilisearch',
      '@aws-sdk/client-s3',
      'bullmq',
      'ioredis',
      'nodemailer',
    ],
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        path: false,
        crypto: false,
        child_process: false,
        worker_threads: false,
        dns: false,
        os: false,
        stream: false,
      };
    }
    return config;
  },

  async headers() {
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: appOrigin },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        ],
      },
      {
        source: '/uploads/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ];
  },

  async rewrites() {
    return [];
  },
};

module.exports = nextConfig;
