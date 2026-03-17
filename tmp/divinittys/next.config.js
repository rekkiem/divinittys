/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: 'localhost', port: '9000', pathname: '/**' },
      { protocol: 'https', hostname: '**.minio.divinittys.cl', pathname: '/**' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com', pathname: '/**' },
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200],
    minimumCacheTTL: 60,
  },

  experimental: {
    serverComponentsExternalPackages: ['bcryptjs', '@prisma/client', 'prisma', 'meilisearch'],
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
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin',      value: process.env.NEXT_PUBLIC_APP_URL || '*' },
          { key: 'Access-Control-Allow-Methods',     value: 'GET,POST,PUT,DELETE,PATCH,OPTIONS' },
          { key: 'Access-Control-Allow-Headers',     value: 'Authorization, Content-Type' },
          { key: 'X-Content-Type-Options',           value: 'nosniff' },
          { key: 'X-Frame-Options',                  value: 'DENY' },
          { key: 'X-XSS-Protection',                 value: '1; mode=block' },
          { key: 'Referrer-Policy',                  value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },

  // FIX: REMOVED the '/admin' → '/admin' self-redirect that caused infinite loop
  // async redirects() { ... } — only add real redirects here if needed
};

module.exports = nextConfig;
