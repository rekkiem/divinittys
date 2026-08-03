/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  compress: true,

  images: {
    remotePatterns: [
      // ── MinIO local (development) ────────────────────────────────
      { protocol: 'http', hostname: 'localhost', port: '9000', pathname: '/imagenes/**' },
      { protocol: 'http', hostname: 'localhost', port: '9000', pathname: '/**' },
      // MinIO inside Docker network
      { protocol: 'http', hostname: 'minio',     port: '9000', pathname: '/imagenes/**' },
      { protocol: 'http', hostname: 'minio',     port: '9000', pathname: '/**' },
      // Production media proxy
      { protocol: 'https', hostname: 'divinittys.cl', pathname: '/media/**' },
      { protocol: 'https', hostname: 'www.divinittys.cl', pathname: '/media/**' },
      // ── Cloud / CDN ──────────────────────────────────────────────
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com', pathname: '/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com',          pathname: '/**' },
      // ── MercadoLibre CDN (imported products) ─────────────────────
      { protocol: 'https', hostname: 'http2.mlstatic.com', pathname: '/**' },
      { protocol: 'https', hostname: '**.mlstatic.com',   pathname: '/**' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 3600,
    // In dev, skip Next.js image optimization for MinIO URLs
    // so images load directly without proxy overhead
    unoptimized: process.env.NODE_ENV === 'development',
  },

  experimental: {
    serverComponentsExternalPackages: [
      'bcryptjs', '@prisma/client', 'prisma', 'meilisearch',
      '@aws-sdk/client-s3',
    ],
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false, tls: false, fs: false,
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
          { key: 'Access-Control-Allow-Origin',      value: appOrigin },
          { key: 'Access-Control-Allow-Methods',     value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers',     value: 'Authorization, Content-Type' },
          { key: 'X-Content-Type-Options',           value: 'nosniff' },
          { key: 'X-Frame-Options',                  value: 'DENY' },
          { key: 'Referrer-Policy',                  value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy',          value: "frame-ancestors 'none'" },
        ],
      },
      // Serve uploaded files from /public/uploads (local fallback)
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
