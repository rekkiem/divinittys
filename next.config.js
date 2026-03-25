/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  images: {
    remotePatterns: [
      // MinIO local Docker
      { protocol: 'http',  hostname: 'localhost',  port: '9000', pathname: '/**' },
      { protocol: 'http',  hostname: 'minio',      port: '9000', pathname: '/**' },
      // MinIO inside Docker network
      { protocol: 'http',  hostname: '*.minio.divinittys.cl', pathname: '/**' },
      // Cloud storage
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com', pathname: '/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      // MercadoLibre CDN (for imported product images)
      { protocol: 'https', hostname: 'http2.mlstatic.com', pathname: '/**' },
      { protocol: 'https', hostname: '**.mlstatic.com', pathname: '/**' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 3600,
    // Allow unoptimized images in development to show MinIO images
    unoptimized: process.env.NODE_ENV === 'development',
  },

  experimental: {
    serverComponentsExternalPackages: ['bcryptjs', '@prisma/client', 'prisma', 'meilisearch'],
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, net: false, tls: false, fs: false };
    }
    return config;
  },

  async headers() {
    return [{
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Credentials', value: 'true' },
        { key: 'Access-Control-Allow-Origin',      value: process.env.NEXT_PUBLIC_APP_URL || '*' },
        { key: 'Access-Control-Allow-Methods',     value: 'GET,POST,PUT,DELETE,PATCH,OPTIONS' },
        { key: 'Access-Control-Allow-Headers',     value: 'Authorization, Content-Type' },
        { key: 'X-Content-Type-Options',           value: 'nosniff' },
        { key: 'X-Frame-Options',                  value: 'DENY' },
        { key: 'Referrer-Policy',                  value: 'strict-origin-when-cross-origin' },
      ],
    }];
  },
};

module.exports = nextConfig;
