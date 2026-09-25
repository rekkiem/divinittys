export const dynamic = 'force-dynamic';

import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

const STATIC_PATHS: { path: string; changeFrequency: 'weekly' | 'monthly'; priority: number }[] = [
  { path: '/productos', changeFrequency: 'daily' as const, priority: 0.9 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/contacto', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/envios', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/devoluciones', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/privacidad', changeFrequency: 'monthly', priority: 0.2 },
  { path: '/terminos', changeFrequency: 'monthly', priority: 0.2 },
  { path: '/diagnostico-capilar', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/asistente-belleza', changeFrequency: 'weekly', priority: 0.6 },
].map((p) => ({
  ...p,
  changeFrequency: p.changeFrequency as 'weekly' | 'monthly' | 'daily',
}));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://divinittys.cl').replace(/\/$/, '');

  const [products, brands] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.brand.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const now = new Date();

  return [
    {
      url: base,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    ...STATIC_PATHS.map(({ path, changeFrequency, priority }) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    })),
    // Solo productos activos — sin query strings
    ...products.map((product) => ({
      url: `${base}/productos/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    // Marcas (si existe ruta /marcas/[slug] en el futuro; por ahora path limpio bajo productos brand filter no se indexa)
    // Las marcas se enlazan internamente; no añadimos ?brand= al sitemap.
  ];
}
