import { createQueue, createWorker, QueueJob } from './core';
import { deleteProductFromIndex, indexProduct } from '@/lib/search/meilisearch';
import { prisma } from '@/lib/prisma';

export const searchQueue = createQueue('search-index');

export async function enqueueProductIndex(productId: string) {
  await searchQueue.add('index-product', { productId });
}

export async function enqueueProductDelete(productId: string) {
  await searchQueue.add('delete-product', { productId });
}

export function startSearchWorker() {
  return createWorker('search-index', async (job: QueueJob) => {
    if (job.name === 'index-product') {
      const productId = String(job.data.productId);
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          category: { select: { name: true, slug: true } },
          brand: { select: { name: true, slug: true } },
          inventory: { select: { stock: true } },
          images: { where: { isMain: true }, take: 1 },
        },
      });

      if (!product) return;

      await indexProduct({
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description ?? null,
        sku: product.sku ?? null,
        basePrice: Number(product.basePrice),
        comparePrice: product.comparePrice ? Number(product.comparePrice) : null,
        isActive: product.isActive,
        isFeatured: product.isFeatured,
        isOnSale: product.isOnSale,
        category: product.category?.name ?? null,
        categorySlug: product.category?.slug ?? null,
        brand: product.brand?.name ?? null,
        brandSlug: product.brand?.slug ?? null,
        tags: product.tags,
        imageUrl: product.images[0]?.url ?? null,
        stock: product.inventory?.stock ?? 0,
        createdAt: product.createdAt.getTime(),
      });
    }
    if (job.name === 'delete-product') {
      await deleteProductFromIndex(String(job.data.productId));
    }
  });
}
