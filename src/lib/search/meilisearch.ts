import { prisma } from '@/lib/prisma';

export async function ensureSearchIndex() {
  return;
}

export async function indexProduct(productId: string) {
  await prisma.product.update({
    where: { id: productId },
    data: { searchIndexed: true, lastIndexedAt: new Date() },
  });
}

export async function deleteProductIndex(_productId: string) {
  return;
}

export async function searchProducts(query: string, options?: Record<string, unknown>) {
  const limit = Number(options?.limit || 24);
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { sku: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: limit,
    include: {
      category: { select: { slug: true } },
      brand: { select: { slug: true, name: true } },
      images: { where: { isMain: true }, take: 1 },
    },
  });

  return {
    hits: products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      description: p.description || '',
      tags: p.tags,
      basePrice: Number(p.basePrice),
      isOnSale: p.isOnSale,
      isFeatured: p.isFeatured,
      categorySlug: p.category.slug,
      brandSlug: p.brand?.slug,
      brandName: p.brand?.name,
      image: p.images[0]?.url,
      createdAt: p.createdAt.getTime(),
    })),
    estimatedTotalHits: products.length,
    facetDistribution: {},
  };
}
