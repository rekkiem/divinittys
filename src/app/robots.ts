import { MetadataRoute } from 'next';

/**
 * robots.txt — Fase 1 SEO
 * - Solo bloquea rutas que no deben rastrearse (/admin, /api)
 * - /cuenta /checkout /wishlist /vendor ya tienen noindex en metadata;
 *   bloquearlas en robots impide que Google lea ese noindex.
 * - Sin directiva Host (Yandex).
 */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://divinittys.cl').replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
