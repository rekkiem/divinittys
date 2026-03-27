#!/usr/bin/env tsx
/**
 * scripts/migrateImages.ts
 * ─────────────────────────────────────────────────────────────────
 * Syncs product.imageUrl from ProductImage records.
 *
 * Strategy:
 *   1. If product has ProductImage rows → set imageUrl = main image (or first)
 *   2. If no ProductImage rows → log a warning (URL cannot be guessed)
 *
 * Usage:
 *   docker exec divinittys_app npx tsx scripts/migrateImages.ts
 *   npx tsx scripts/migrateImages.ts
 */
import { PrismaClient } from '@prisma/client';
import { getPublicUrl, getBucketName } from '../src/services/minioClient';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

async function run() {
  console.log('\n🔄 DIVINITTYS — Migración de imageUrl\n');

  const products = await prisma.product.findMany({
    include: { images: { orderBy: [{ isMain: 'desc' }, { sortOrder: 'asc' }] } },
  });

  console.log(`   Productos a procesar: ${products.length}\n`);

  let updated = 0;
  let skipped = 0;
  let noImage = 0;

  for (const product of products) {
    const mainImg = product.images.find(i => i.isMain) || product.images[0];

    if (!mainImg) {
      // No images at all — generate a hint but do not auto-set
      const hint = getPublicUrl(
        `products/${product.id}/${product.slug}.jpg`,
        getBucketName()
      );
      console.log(`   ⚠️  ${product.name}`);
      console.log(`      → Sin imágenes en DB`);
      console.log(`      → URL sugerida: ${hint}`);
      console.log(`      → Sube una imagen desde /admin/productos/${product.slug}/editar\n`);
      noImage++;
      continue;
    }

    if (product.imageUrl === mainImg.url) {
      skipped++;
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data:  { imageUrl: mainImg.url },
    });

    console.log(`   ✅ ${product.name}`);
    console.log(`      → imageUrl: ${mainImg.url}\n`);
    updated++;
  }

  console.log('─────────────────────────────────────────');
  console.log(`  Actualizados: ${updated}`);
  console.log(`  Sin cambios:  ${skipped}`);
  console.log(`  Sin imagen:   ${noImage}`);
  console.log('─────────────────────────────────────────\n');

  if (noImage > 0) {
    console.log('💡 Para los productos sin imagen:');
    console.log('   1. Ve a /admin/productos');
    console.log('   2. Edita cada producto');
    console.log('   3. Sube la imagen desde el panel de imágenes');
    console.log('   4. Guarda — la URL se persiste automáticamente en MinIO\n');
  }
}

run()
  .catch(err => { console.error('\n❌ Error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
