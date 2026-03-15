
export const dynamic = 'force-dynamic';

import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    prisma.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
  ]);

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    ...products.map((product) => ({
      url: `${base}/productos/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...categories.map((category) => ({
      url: `${base}/productos?category=${category.slug}`,
      lastModified: category.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
