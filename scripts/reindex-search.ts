/**
 * scripts/reindex-search.ts
 * Re-indexa todos los productos activos en Meilisearch
 * Uso: npx tsx scripts/reindex-search.ts
 */
import { PrismaClient } from '@prisma/client';
import { reindexAll, setupMeiliIndex, getMeiliClient, type MeiliProduct } from '../src/lib/search/meilisearch';

async function main() {
  const meiliUrl = process.env.MEILISEARCH_URL;
  if (!meiliUrl) {
    console.log('ℹ️  MEILISEARCH_URL no configurada — skip reindex');
    process.exit(0);
  }

  const client = getMeiliClient();
  if (!client) {
    console.log('ℹ️  Meilisearch no disponible — skip reindex');
    process.exit(0);
  }

  // Esperar a que Meilisearch esté listo (útil en Docker startup)
  let retries = 0;
  while (retries < 10) {
    try {
      const health = await client.health();
      if (health.status === 'available') break;
    } catch {
      retries++;
      console.log(`⏳ Esperando Meilisearch... (${retries}/10)`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  const prisma = new PrismaClient();

  try {
    await setupMeiliIndex();

    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: true,
        brand: true,
        images: { take: 1 },
        inventory: true,
      },
    });

    if (products.length === 0) {
      console.log('ℹ️  No hay productos para indexar');
      return;
    }

    const docs: MeiliProduct[] = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      sku: p.sku,
      basePrice: Number(p.basePrice),
      comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      isOnSale: !!(p.comparePrice && Number(p.comparePrice) > Number(p.basePrice)),
      category: p.category?.name ?? null,
      categorySlug: p.category?.slug ?? null,
      brand: p.brand?.name ?? null,
      brandSlug: p.brand?.slug ?? null,
      tags: Array.isArray(p.tags) ? p.tags : [],
      imageUrl: p.images[0]?.url ?? null,
      stock: p.inventory?.stock ?? 0,
      createdAt: new Date(p.createdAt).getTime(),
    }));

    await reindexAll(docs);
    console.log(`✅ ${docs.length} productos indexados en Meilisearch`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌ Reindex error:', e);
  process.exit(0); // exit 0 para no bloquear el startup de Docker
});
