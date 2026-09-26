export const dynamic = 'force-dynamic';

import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

type Freq = NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;

const STATIC_PATHS: { path: string; changeFrequency: Freq; priority: number }[] = [
  { path: '/productos', changeFrequency: 'daily', priority: 0.9 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/faq', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/contacto', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/envios', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/devoluciones', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/privacidad', changeFrequency: 'monthly', priority: 0.2 },
  { path: '/terminos', changeFrequency: 'monthly', priority: 0.2 },
  { path: '/diagnostico-capilar', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/asistente-belleza', changeFrequency: 'weekly', priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://divinittys.cl').replace(/\/$/, '');

  // Solo BEAUTY en sitemap SEO — SECONDARY no compite por ranking de belleza
  const products = await prisma.product.findMany({
    where: { isActive: true, catalogScope: 'BEAUTY' },
    select: { slug: true, updatedAt: true },
  });

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
    ...products.map((product) => ({
      url: `${base}/productos/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];
}
