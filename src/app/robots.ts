import { MetadataRoute } from 'next';

/**
 * robots.txt — higiene de crawl (Fase 3 SEO).
 * Sitemap canónico; bloqueo de rutas privadas y API.
 */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://divinittys.cl').replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/api/',
          '/cuenta',
          '/cuenta/',
          '/checkout',
          '/checkout/',
          '/wishlist',
          '/vendor',
          '/vendor/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
