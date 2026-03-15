import { prisma } from '@/lib/prisma';
import { indexProduct, ensureSearchIndex } from '@/lib/search/meilisearch';

async function main() {
  await ensureSearchIndex();
  const batch = 1000;
  let cursor: string | undefined;

  while (true) {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      take: batch,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    if (!products.length) break;

    for (const p of products) {
      await indexProduct(p.id);
    }

    cursor = products[products.length - 1].id;
    console.log(`Indexed ${products.length} products. Last cursor: ${cursor}`);
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
