export const dynamic = 'force-dynamic';

import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

/**
 * Sitemap honesto (Fase 1 SEO)
 * - lastModified fijo en estáticas (actualizar a mano si cambia el contenido)
 * - sin changeFrequency / priority (Google los ignora)
 * - solo productos BEAUTY activos
 */
const STATIC_PATHS: { path: string; lastModified: string }[] = [
  { path: '/productos', lastModified: '2026-09-26' },
  { path: '/about', lastModified: '2026-09-26' },
  { path: '/faq', lastModified: '2026-09-26' },
  { path: '/contacto', lastModified: '2026-09-26' },
  { path: '/envios', lastModified: '2026-09-26' },
  { path: '/devoluciones', lastModified: '2026-09-26' },
  { path: '/privacidad', lastModified: '2026-09-26' },
  { path: '/terminos', lastModified: '2026-09-26' },
  { path: '/diagnostico-capilar', lastModified: '2026-09-26' },
  { path: '/asistente-belleza', lastModified: '2026-09-26' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://divinittys.cl').replace(/\/$/, '');

  const products = await prisma.product.findMany({
    where: { isActive: true, catalogScope: 'BEAUTY' },
    select: { slug: true, updatedAt: true },
  });

  return [
    {
      url: base,
      lastModified: new Date('2026-09-26'),
    },
    ...STATIC_PATHS.map(({ path, lastModified }) => ({
      url: `${base}${path}`,
      lastModified: new Date(lastModified),
    })),
    ...products.map((product) => ({
      url: `${base}/productos/${product.slug}`,
      lastModified: product.updatedAt,
    })),
  ];
}
